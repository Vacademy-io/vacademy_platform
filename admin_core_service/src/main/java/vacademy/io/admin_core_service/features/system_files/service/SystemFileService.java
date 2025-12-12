package vacademy.io.admin_core_service.features.system_files.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.system_files.dto.*;
import vacademy.io.admin_core_service.features.system_files.entity.EntityAccess;
import vacademy.io.admin_core_service.features.system_files.entity.SystemFile;
import vacademy.io.admin_core_service.features.system_files.enums.AccessLevelEnum;
import vacademy.io.admin_core_service.features.system_files.enums.AccessTypeEnum;
import vacademy.io.admin_core_service.features.system_files.enums.FileTypeEnum;
import vacademy.io.admin_core_service.features.system_files.enums.MediaTypeEnum;
import vacademy.io.admin_core_service.features.system_files.enums.StatusEnum;
import vacademy.io.admin_core_service.features.system_files.repository.EntityAccessRepository;
import vacademy.io.admin_core_service.features.system_files.repository.SystemFileRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SystemFileService {

        private final SystemFileRepository systemFileRepository;
        private final EntityAccessRepository entityAccessRepository;
        private final AuthService authService;
        private final StudentSessionInstituteGroupMappingRepository studentSessionInstituteGroupMappingRepository;
        private final InstituteStudentRepository instituteStudentRepository;

        @Transactional
        public SystemFileAddResponseDTO addSystemFile(SystemFileRequestDTO request, String instituteId,
                        CustomUserDetails user) {
                log.info("Adding system file: {} for user: {} in institute: {}", request.getName(), user.getUserId(),
                                instituteId);

                // Validate file type and media type
                validateFileType(request.getFileType());
                validateMediaType(request.getMediaType());

                // Create SystemFile entity
                SystemFile systemFile = new SystemFile();
                systemFile.setFileType(request.getFileType());
                systemFile.setMediaType(request.getMediaType());
                systemFile.setData(request.getData());
                systemFile.setName(request.getName());
                systemFile.setFolderName(request.getFolderName());
                systemFile.setThumbnailFileId(request.getThumbnailFileId());
                systemFile.setDescription(request.getDescription());
                systemFile.setInstituteId(instituteId);
                systemFile.setCreatedByUserId(user.getUserId());
                systemFile.setStatus(StatusEnum.ACTIVE.name());

                // Save system file
                SystemFile savedSystemFile = systemFileRepository.save(systemFile);
                log.info("System file saved with ID: {}", savedSystemFile.getId());

                // Create access records
                List<EntityAccess> accessList = new ArrayList<>();

                // Auto-grant view and edit access to creator
                accessList.add(createEntityAccess(savedSystemFile.getId(), AccessTypeEnum.view.name(),
                                AccessLevelEnum.user.name(), user.getUserId()));
                accessList.add(createEntityAccess(savedSystemFile.getId(), AccessTypeEnum.edit.name(),
                                AccessLevelEnum.user.name(), user.getUserId()));

                // Process view access (convert usernames to userIds if needed)
                if (request.getViewAccess() != null && !request.getViewAccess().isEmpty()) {
                        List<AccessDTO> processedViewAccess = processAccessDTOs(request.getViewAccess(), instituteId);
                        for (AccessDTO accessDTO : processedViewAccess) {
                                validateAccessLevel(accessDTO.getLevel());
                                accessList.add(createEntityAccess(savedSystemFile.getId(),
                                                AccessTypeEnum.view.name(), accessDTO.getLevel(),
                                                accessDTO.getLevelId()));
                        }
                }

                // Process edit access (convert usernames to userIds if needed)
                if (request.getEditAccess() != null && !request.getEditAccess().isEmpty()) {
                        List<AccessDTO> processedEditAccess = processAccessDTOs(request.getEditAccess(), instituteId);
                        for (AccessDTO accessDTO : processedEditAccess) {
                                validateAccessLevel(accessDTO.getLevel());
                                accessList.add(createEntityAccess(savedSystemFile.getId(),
                                                AccessTypeEnum.edit.name(), accessDTO.getLevel(),
                                                accessDTO.getLevelId()));
                        }
                }

                // Save all access records
                entityAccessRepository.saveAll(accessList);
                log.info("Created {} access records for system file: {}", accessList.size(), savedSystemFile.getId());

                // Return only the ID
                return new SystemFileAddResponseDTO(savedSystemFile.getId());
        }

        private EntityAccess createEntityAccess(String entityId, String accessType, String level, String levelId) {
                EntityAccess entityAccess = new EntityAccess();
                entityAccess.setEntity("system_file");
                entityAccess.setEntityId(entityId);
                entityAccess.setAccessType(accessType);
                entityAccess.setLevel(level);
                entityAccess.setLevelId(levelId);
                return entityAccess;
        }

        private void validateFileType(String fileType) {
                try {
                        FileTypeEnum.valueOf(fileType);
                } catch (IllegalArgumentException e) {
                        throw new IllegalArgumentException("Invalid file type: " + fileType +
                                        ". Must be one of: File, Url, Html");
                }
        }

        private void validateMediaType(String mediaType) {
                try {
                        MediaTypeEnum.valueOf(mediaType);
                } catch (IllegalArgumentException e) {
                        throw new IllegalArgumentException("Invalid media type: " + mediaType +
                                        ". Must be one of: video, audio, pdf, doc, image, note, unknown");
                }
        }

        private void validateAccessLevel(String level) {
                try {
                        AccessLevelEnum.valueOf(level);
                } catch (IllegalArgumentException e) {
                        throw new IllegalArgumentException("Invalid access level: " + level +
                                        ". Must be one of: user, batch, institute, role");
                }
        }

        /**
         * Process access DTOs to convert usernames to userIds for user-level access
         */
        private List<AccessDTO> processAccessDTOs(List<AccessDTO> accessDTOs, String instituteId) {
                List<AccessDTO> processedDTOs = new ArrayList<>();
                List<String> usernamesToConvert = new ArrayList<>();

                // First pass: collect usernames that need conversion
                for (AccessDTO accessDTO : accessDTOs) {
                        if ("user".equals(accessDTO.getLevel()) && accessDTO.getLevelId() != null) {
                                // Check if levelId looks like a username (not a UUID)
                                if (!isValidUUID(accessDTO.getLevelId())) {
                                        usernamesToConvert.add(accessDTO.getLevelId());
                                }
                        }
                }

                // Convert usernames to userIds
                Map<String, String> usernameToUserIdMap = new HashMap<>();
                if (!usernamesToConvert.isEmpty()) {
                        // Query each username individually for accurate mapping
                        for (String username : usernamesToConvert) {
                                List<String> singleUserId = instituteStudentRepository.findUserIdsByUsernames(List.of(username));
                                if (!singleUserId.isEmpty()) {
                                        usernameToUserIdMap.put(username, singleUserId.get(0));
                                        log.debug("Converted username '{}' to userId '{}'", username, singleUserId.get(0));
                                } else {
                                        log.warn("Could not find userId for username '{}', skipping access", username);
                                }
                        }
                }

                // Second pass: create processed DTOs with converted IDs
                for (AccessDTO accessDTO : accessDTOs) {
                        AccessDTO processedDTO = new AccessDTO();
                        processedDTO.setLevel(accessDTO.getLevel());

                        if ("user".equals(accessDTO.getLevel()) && accessDTO.getLevelId() != null) {
                                String convertedId = usernameToUserIdMap.get(accessDTO.getLevelId());
                                if (convertedId != null) {
                                        processedDTO.setLevelId(convertedId);
                                        log.debug("Using converted userId '{}' for access level", convertedId);
                                } else if (isValidUUID(accessDTO.getLevelId())) {
                                        // It's already a valid UUID, use as-is
                                        processedDTO.setLevelId(accessDTO.getLevelId());
                                        log.debug("Using provided userId '{}' for access level", accessDTO.getLevelId());
                                } else {
                                        // Skip this access entry if conversion failed and it's not a valid UUID
                                        log.warn("Skipping access for invalid identifier '{}'", accessDTO.getLevelId());
                                        continue;
                                }
                        } else {
                                // For non-user levels, use levelId as-is
                                processedDTO.setLevelId(accessDTO.getLevelId());
                        }

                        processedDTOs.add(processedDTO);
                }

                return processedDTOs;
        }

        /**
         * Check if a string is a valid UUID format
         */
        private boolean isValidUUID(String str) {
                if (str == null || str.length() != 36) {
                        return false;
                }
                try {
                        java.util.UUID.fromString(str);
                        return true;
                } catch (IllegalArgumentException e) {
                        return false;
                }
        }

        @Transactional(readOnly = true)
        @Cacheable(value = "systemFileList", key = "#request.level + ':' + #request.levelId + ':' + #request.accessType + ':' + #instituteId", unless = "#result == null || #result.files.isEmpty()")
        public SystemFileListResponseDTO getSystemFilesByAccess(SystemFileListRequestDTO request, String instituteId,
                        CustomUserDetails user) {
                log.info("Getting system files for level: {}, levelId: {}, accessType: {}, statuses: {}, institute: {}",
                                request.getLevel(), request.getLevelId(), request.getAccessType(), request.getStatuses(), instituteId);

                // Validate access level
                validateAccessLevel(request.getLevel());

                // Validate access type if provided
                if (request.getAccessType() != null && !request.getAccessType().trim().isEmpty()) {
                        validateAccessType(request.getAccessType());
                }

                // Determine statuses to filter by (default to ACTIVE only)
                List<String> statuses = request.getStatuses();
                if (statuses == null || statuses.isEmpty()) {
                        statuses = List.of(StatusEnum.ACTIVE.name());
                } else {
                        // Validate each status
                        for (String status : statuses) {
                                validateStatus(status);
                        }
                }
                
                log.info("Filtering by statuses: {}", statuses);

                // Get entity access records based on filter
                List<EntityAccess> accessRecords;
                if (request.getAccessType() != null && !request.getAccessType().trim().isEmpty()) {
                        // Filter by specific access type
                        accessRecords = entityAccessRepository.findByEntityAndLevelAndLevelIdAndAccessType(
                                        "system_file", request.getLevel(), request.getLevelId(),
                                        request.getAccessType());
                } else {
                        // Get all access types
                        accessRecords = entityAccessRepository.findByEntityAndLevelAndLevelId(
                                        "system_file", request.getLevel(), request.getLevelId());
                }

                if (accessRecords.isEmpty()) {
                        log.info("No access records found for level: {}, levelId: {}", request.getLevel(),
                                        request.getLevelId());
                        return new SystemFileListResponseDTO(new ArrayList<>());
                }

                // Group access types by entity_id
                Map<String, List<String>> entityAccessMap = new HashMap<>();
                for (EntityAccess access : accessRecords) {
                        entityAccessMap
                                        .computeIfAbsent(access.getEntityId(), k -> new ArrayList<>())
                                        .add(access.getAccessType());
                }

                // Get unique entity IDs
                List<String> entityIds = new ArrayList<>(entityAccessMap.keySet());

                // Fetch system files
                List<SystemFile> systemFiles = systemFileRepository.findAllById(entityIds);

                // Filter by institute and requested statuses
                final List<String> finalStatuses = statuses;
                List<SystemFile> filteredFiles = systemFiles.stream()
                                .filter(file -> file.getInstituteId().equals(instituteId) &&
                                                finalStatuses.contains(file.getStatus()))
                                .collect(Collectors.toList());

                log.info("Found {} files after filtering by institute and statuses", filteredFiles.size());

                // Get unique user IDs from created_by_user_id
                List<String> userIds = filteredFiles.stream()
                                .map(SystemFile::getCreatedByUserId)
                                .distinct()
                                .collect(Collectors.toList());

                // Fetch user details from auth service
                Map<String, String> userIdToNameMap = new HashMap<>();
                if (!userIds.isEmpty()) {
                        try {
                                List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(userIds);
                                userIdToNameMap = users.stream()
                                                .collect(Collectors.toMap(
                                                                UserDTO::getId,
                                                                userDto -> userDto.getFullName() != null
                                                                                ? userDto.getFullName()
                                                                                : "Unknown",
                                                                (existing, replacement) -> existing));
                        } catch (Exception e) {
                                log.error("Error fetching user details from auth service: {}", e.getMessage());
                        }
                }

                // Final map for use in lambda
                final Map<String, String> userNameMap = userIdToNameMap;

                // Map to response DTO
                List<SystemFileItemDTO> fileItems = filteredFiles.stream()
                                .map(file -> {
                                        SystemFileItemDTO item = new SystemFileItemDTO();
                                        item.setId(file.getId());
                                        item.setFileType(file.getFileType());
                                        item.setMediaType(file.getMediaType());
                                        item.setData(file.getData());
                                        item.setName(file.getName());
                                        item.setFolderName(file.getFolderName());
                                        item.setThumbnailFileId(file.getThumbnailFileId());
                                        item.setDescription(file.getDescription());
                                        item.setCreatedAtIso(file.getCreatedAt());
                                        item.setUpdatedAtIso(file.getUpdatedAt());
                                        item.setCreatedBy(
                                                        userNameMap.getOrDefault(file.getCreatedByUserId(), "Unknown"));
                                        item.setAccessTypes(
                                                        entityAccessMap.getOrDefault(file.getId(), new ArrayList<>()));
                                        return item;
                                })
                                .collect(Collectors.toList());

                log.info("Found {} system files for level: {}, levelId: {}", fileItems.size(), request.getLevel(),
                                request.getLevelId());
                return new SystemFileListResponseDTO(fileItems);
        }

        private void validateAccessType(String accessType) {
                try {
                        AccessTypeEnum.valueOf(accessType);
                } catch (IllegalArgumentException e) {
                        throw new IllegalArgumentException("Invalid access type: " + accessType +
                                        ". Must be one of: view, edit");
                }
        }

        @Transactional(readOnly = true)
        public SystemFileAccessDetailsResponseDTO getSystemFileAccessDetails(String fileId, String instituteId,
                        CustomUserDetails user) {
                log.info("Getting access details for file: {} in institute: {} by user: {}", fileId, instituteId,
                                user.getUserId());

                // Fetch system file by ID and institute (no status filter - include all
                // statuses)
                SystemFile systemFile = systemFileRepository.findByIdAndInstituteId(fileId, instituteId)
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "System file not found with ID: " + fileId));

                log.info("Found system file: {} with status: {}", systemFile.getName(), systemFile.getStatus());

                // Get creator name from auth service
                String createdByName = "Unknown";
                try {
                        List<UserDTO> users = authService
                                        .getUsersFromAuthServiceByUserIds(List.of(systemFile.getCreatedByUserId()));
                        if (!users.isEmpty() && users.get(0).getFullName() != null) {
                                createdByName = users.get(0).getFullName();
                        }
                } catch (Exception e) {
                        log.error("Error fetching creator details from auth service: {}", e.getMessage());
                }

                // Fetch all access records for this file
                List<EntityAccess> accessRecords = entityAccessRepository.findByEntityAndEntityId("system_file",
                                fileId);

                // Map to AccessDetailItemDTO with is_creator flag
                List<AccessDetailItemDTO> accessList = accessRecords.stream()
                                .map(access -> {
                                        AccessDetailItemDTO item = new AccessDetailItemDTO();
                                        item.setId(access.getId());
                                        item.setAccessType(access.getAccessType());
                                        item.setLevel(access.getLevel());
                                        item.setLevelId(access.getLevelId());
                                        item.setCreatedAtIso(access.getCreatedAt());

                                        // Mark as creator if it's a user-level access for the creator
                                        boolean isCreator = access.getLevel().equals(AccessLevelEnum.user.name()) &&
                                                        access.getLevelId().equals(systemFile.getCreatedByUserId());
                                        item.setIsCreator(isCreator);

                                        return item;
                                })
                                .collect(Collectors.toList());

                // Build response DTO
                SystemFileAccessDetailsResponseDTO response = new SystemFileAccessDetailsResponseDTO();
                response.setId(systemFile.getId());
                response.setName(systemFile.getName());
                response.setFileType(systemFile.getFileType());
                response.setMediaType(systemFile.getMediaType());
                response.setData(systemFile.getData());
                response.setDescription(systemFile.getDescription());
                response.setStatus(systemFile.getStatus());
                response.setCreatedBy(createdByName);
                response.setCreatedByUserId(systemFile.getCreatedByUserId());
                response.setCreatedAtIso(systemFile.getCreatedAt());
                response.setUpdatedAtIso(systemFile.getUpdatedAt());
                response.setAccessList(accessList);

                log.info("Returning access details with {} access records for file: {}", accessList.size(), fileId);
                return response;
        }

        @Transactional
        @CacheEvict(value = "systemFileList", allEntries = true)
        public SystemFileUpdateAccessResponseDTO updateSystemFileAccess(SystemFileUpdateAccessRequestDTO request,
                        String instituteId, CustomUserDetails user) {
                log.info("Updating access for file: {} by user: {} in institute: {}", request.getSystemFileId(),
                                user.getUserId(), instituteId);

                // 1. Fetch system file by ID and institute (all statuses allowed)
                SystemFile systemFile = systemFileRepository
                                .findByIdAndInstituteId(request.getSystemFileId(), instituteId)
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "System file not found with ID: " + request.getSystemFileId()));

                log.info("Found system file: {} with status: {}", systemFile.getName(), systemFile.getStatus());

                // 2. Check authorization - does user have edit access?
                boolean hasEditAccess = checkUserHasEditAccess(systemFile, user, request.getUserRoles(), instituteId);

                if (!hasEditAccess) {
                        throw new IllegalArgumentException(
                                        "User does not have edit access to update this file's permissions");
                }

                log.info("User {} has edit access, proceeding with update", user.getUserId());

                // 3. Optionally update file status if provided
                if (request.getStatus() != null && !request.getStatus().trim().isEmpty()) {
                        validateStatus(request.getStatus());
                        systemFile.setStatus(request.getStatus());
                        systemFileRepository.save(systemFile);
                        log.info("Updated file status to: {}", request.getStatus());
                }

                // 4. Delete all existing access records (we'll preserve creator's later)
                List<EntityAccess> existingAccess = entityAccessRepository.findByEntityAndEntityId("system_file",
                                request.getSystemFileId());
                entityAccessRepository.deleteAll(existingAccess);
                log.info("Deleted {} existing access records", existingAccess.size());

                // 5. Create new access records
                List<EntityAccess> newAccessRecords = new ArrayList<>();

                // Process view access
                if (request.getViewAccess() != null && !request.getViewAccess().isEmpty()) {
                        for (AccessDTO accessDTO : request.getViewAccess()) {
                                validateAccessLevel(accessDTO.getLevel());
                                newAccessRecords.add(createEntityAccess(request.getSystemFileId(),
                                                AccessTypeEnum.view.name(), accessDTO.getLevel(),
                                                accessDTO.getLevelId()));
                        }
                }

                // Process edit access
                if (request.getEditAccess() != null && !request.getEditAccess().isEmpty()) {
                        for (AccessDTO accessDTO : request.getEditAccess()) {
                                validateAccessLevel(accessDTO.getLevel());
                                newAccessRecords.add(createEntityAccess(request.getSystemFileId(),
                                                AccessTypeEnum.edit.name(), accessDTO.getLevel(),
                                                accessDTO.getLevelId()));
                        }
                }

                // 6. Force-add creator's immutable access (view + edit)
                String creatorUserId = systemFile.getCreatedByUserId();

                // Check if creator's view access already exists in new records
                boolean hasCreatorView = newAccessRecords.stream()
                                .anyMatch(a -> a.getLevel().equals(AccessLevelEnum.user.name())
                                                && a.getLevelId().equals(creatorUserId)
                                                && a.getAccessType().equals(AccessTypeEnum.view.name()));

                if (!hasCreatorView) {
                        newAccessRecords.add(createEntityAccess(request.getSystemFileId(),
                                        AccessTypeEnum.view.name(), AccessLevelEnum.user.name(), creatorUserId));
                        log.info("Added creator's view access (immutable)");
                }

                // Check if creator's edit access already exists
                boolean hasCreatorEdit = newAccessRecords.stream()
                                .anyMatch(a -> a.getLevel().equals(AccessLevelEnum.user.name())
                                                && a.getLevelId().equals(creatorUserId)
                                                && a.getAccessType().equals(AccessTypeEnum.edit.name()));

                if (!hasCreatorEdit) {
                        newAccessRecords.add(createEntityAccess(request.getSystemFileId(),
                                        AccessTypeEnum.edit.name(), AccessLevelEnum.user.name(), creatorUserId));
                        log.info("Added creator's edit access (immutable)");
                }

                // 7. Save all new access records
                entityAccessRepository.saveAll(newAccessRecords);
                log.info("Created {} new access records for system file: {}", newAccessRecords.size(),
                                request.getSystemFileId());

                return new SystemFileUpdateAccessResponseDTO(true, "Access updated successfully",
                                newAccessRecords.size());
        }

        private boolean checkUserHasEditAccess(SystemFile systemFile, CustomUserDetails user, List<String> userRoles,
                        String instituteId) {
                String userId = user.getUserId();

                // 1. Check if user is creator
                if (systemFile.getCreatedByUserId().equals(userId)) {
                        log.info("User is creator - access granted");
                        return true;
                }

                // 2. Check direct user-level edit access
                List<EntityAccess> userAccess = entityAccessRepository.findByEntityAndLevelAndLevelIdAndAccessType(
                                "system_file", AccessLevelEnum.user.name(), userId, AccessTypeEnum.edit.name());
                if (!userAccess.isEmpty()) {
                        log.info("User has direct edit access - access granted");
                        return true;
                }

                // 3. Check role-level edit access (if roles provided in request)
                if (userRoles != null && !userRoles.isEmpty()) {
                        for (String role : userRoles) {
                                List<EntityAccess> roleAccess = entityAccessRepository
                                                .findByEntityAndLevelAndLevelIdAndAccessType(
                                                                "system_file", AccessLevelEnum.role.name(), role,
                                                                AccessTypeEnum.edit.name());
                                if (!roleAccess.isEmpty()) {
                                        log.info("User's role {} has edit access - access granted", role);
                                        return true;
                                }
                        }
                }

                // 4. Check batch-level edit access
                List<String> userBatchIds = getUserBatchIds(userId, instituteId);
                if (!userBatchIds.isEmpty()) {
                        for (String batchId : userBatchIds) {
                                List<EntityAccess> batchAccess = entityAccessRepository
                                                .findByEntityAndLevelAndLevelIdAndAccessType(
                                                                "system_file", AccessLevelEnum.batch.name(), batchId,
                                                                AccessTypeEnum.edit.name());
                                if (!batchAccess.isEmpty()) {
                                        log.info("User's batch {} has edit access - access granted", batchId);
                                        return true;
                                }
                        }
                }

                // 5. Check institute-level edit access
                List<EntityAccess> instituteAccess = entityAccessRepository.findByEntityAndLevelAndLevelIdAndAccessType(
                                "system_file", AccessLevelEnum.institute.name(), instituteId,
                                AccessTypeEnum.edit.name());
                if (!instituteAccess.isEmpty()) {
                        log.info("Institute has edit access - access granted");
                        return true;
                }

                log.info("User does not have edit access");
                return false;
        }

        private List<String> getUserBatchIds(String userId, String instituteId) {
                try {
                        // Optimized query to get package_session_ids directly from database
                        return studentSessionInstituteGroupMappingRepository
                                        .findPackageSessionIdsByUserIdAndInstituteId(userId, instituteId);
                } catch (Exception e) {
                        log.error("Error fetching user's batch IDs: {}", e.getMessage());
                        return new ArrayList<>();
                }
        }

        private void validateStatus(String status) {
                try {
                        StatusEnum.valueOf(status);
                } catch (IllegalArgumentException e) {
                        throw new IllegalArgumentException("Invalid status: " + status +
                                        ". Must be one of: ACTIVE, DELETED, ARCHIVED");
                }
        }

        @Transactional(readOnly = true)
        public SystemFileListResponseDTO getMyFiles(MyFilesRequestDTO request, String instituteId,
                        CustomUserDetails user) {
                String userId = user.getUserId();
                log.info("Getting my files for user: {} in institute: {}, roles: {}, accessType: {}, statuses: {}",
                                userId, instituteId, request.getUserRoles(), request.getAccessType(),
                                request.getStatuses());

                // 1. Determine statuses to filter by (default to ACTIVE only)
                List<String> statuses = request.getStatuses();
                if (statuses == null || statuses.isEmpty()) {
                        statuses = List.of(StatusEnum.ACTIVE.name());
                } else {
                        // Validate each status
                        for (String status : statuses) {
                                validateStatus(status);
                        }
                }

                // 2. Validate access type if provided
                if (request.getAccessType() != null && !request.getAccessType().trim().isEmpty()) {
                        validateAccessType(request.getAccessType());
                }

                // 3. Collect all entity_access records where user has access
                List<EntityAccess> allAccessRecords = new ArrayList<>();

                // 3a. Direct user-level access
                List<EntityAccess> userAccess = entityAccessRepository.findByEntityAndLevelAndLevelId(
                                "system_file", AccessLevelEnum.user.name(), userId);
                allAccessRecords.addAll(userAccess);
                log.info("Found {} user-level access records", userAccess.size());

                // 3b. Role-based access (if roles provided)
                if (request.getUserRoles() != null && !request.getUserRoles().isEmpty()) {
                        for (String role : request.getUserRoles()) {
                                List<EntityAccess> roleAccess = entityAccessRepository
                                                .findByEntityAndLevelAndLevelId(
                                                                "system_file", AccessLevelEnum.role.name(), role);
                                allAccessRecords.addAll(roleAccess);
                        }
                        log.info("Found {} role-based access records", allAccessRecords.size() - userAccess.size());
                }

                // 3c. Batch-based access
                List<String> userBatchIds = getUserBatchIds(userId, instituteId);
                if (!userBatchIds.isEmpty()) {
                        log.info("User belongs to {} batches", userBatchIds.size());
                        for (String batchId : userBatchIds) {
                                List<EntityAccess> batchAccess = entityAccessRepository
                                                .findByEntityAndLevelAndLevelId(
                                                                "system_file", AccessLevelEnum.batch.name(), batchId);
                                allAccessRecords.addAll(batchAccess);
                        }
                }

                // 3d. Institute-level access
                List<EntityAccess> instituteAccess = entityAccessRepository.findByEntityAndLevelAndLevelId(
                                "system_file", AccessLevelEnum.institute.name(), instituteId);
                allAccessRecords.addAll(instituteAccess);
                log.info("Found {} institute-level access records", instituteAccess.size());

                // 4. Filter by access_type if provided
                if (request.getAccessType() != null && !request.getAccessType().trim().isEmpty()) {
                        final String accessTypeFilter = request.getAccessType();
                        allAccessRecords = allAccessRecords.stream()
                                        .filter(a -> a.getAccessType().equals(accessTypeFilter))
                                        .collect(Collectors.toList());
                        log.info("After access_type filter: {} records", allAccessRecords.size());
                }

                // 5. Group by entity_id and collect access types
                Map<String, List<String>> entityAccessMap = new HashMap<>();
                for (EntityAccess access : allAccessRecords) {
                        entityAccessMap
                                        .computeIfAbsent(access.getEntityId(), k -> new ArrayList<>())
                                        .add(access.getAccessType());
                }

                // 6. Get unique file IDs from access records
                List<String> fileIds = new ArrayList<>(entityAccessMap.keySet());

                // 7. Also include files created by user
                List<SystemFile> createdFiles = systemFileRepository
                                .findByCreatedByUserIdAndInstituteIdAndStatusIn(userId, instituteId, statuses);
                log.info("User created {} files", createdFiles.size());

                for (SystemFile file : createdFiles) {
                        if (!entityAccessMap.containsKey(file.getId())) {
                                fileIds.add(file.getId());
                                // Creator has both view and edit access
                                entityAccessMap.put(file.getId(), List.of(AccessTypeEnum.view.name(),
                                                AccessTypeEnum.edit.name()));
                        }
                }

                if (fileIds.isEmpty()) {
                        log.info("No files found for user");
                        return new SystemFileListResponseDTO(new ArrayList<>());
                }

                // 8. Fetch system files
                List<SystemFile> systemFiles = systemFileRepository.findAllById(fileIds);

                // 9. Filter by institute and status
                final List<String> finalStatuses = statuses;
                List<SystemFile> filteredFiles = systemFiles.stream()
                                .filter(file -> file.getInstituteId().equals(instituteId))
                                .filter(file -> finalStatuses.contains(file.getStatus()))
                                .collect(Collectors.toList());

                // 10. Get unique user IDs from created_by_user_id
                List<String> userIds = filteredFiles.stream()
                                .map(SystemFile::getCreatedByUserId)
                                .distinct()
                                .collect(Collectors.toList());

                // 11. Fetch user details from auth service
                Map<String, String> userIdToNameMap = new HashMap<>();
                if (!userIds.isEmpty()) {
                        try {
                                List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(userIds);
                                userIdToNameMap = users.stream()
                                                .collect(Collectors.toMap(
                                                                UserDTO::getId,
                                                                userDto -> userDto.getFullName() != null
                                                                                ? userDto.getFullName()
                                                                                : "Unknown",
                                                                (existing, replacement) -> existing));
                        } catch (Exception e) {
                                log.error("Error fetching user details from auth service: {}", e.getMessage());
                        }
                }

                // Final map for use in lambda
                final Map<String, String> userNameMap = userIdToNameMap;

                // 12. Map to response DTO
                List<SystemFileItemDTO> fileItems = filteredFiles.stream()
                                .map(file -> {
                                        SystemFileItemDTO item = new SystemFileItemDTO();
                                        item.setId(file.getId());
                                        item.setFileType(file.getFileType());
                                        item.setMediaType(file.getMediaType());
                                        item.setData(file.getData());
                                        item.setName(file.getName());
                                        item.setFolderName(file.getFolderName());
                                        item.setThumbnailFileId(file.getThumbnailFileId());
                                        item.setDescription(file.getDescription());
                                        item.setCreatedAtIso(file.getCreatedAt());
                                        item.setUpdatedAtIso(file.getUpdatedAt());
                                        item.setCreatedBy(
                                                        userNameMap.getOrDefault(file.getCreatedByUserId(), "Unknown"));
                                        item.setAccessTypes(
                                                        entityAccessMap.getOrDefault(file.getId(), new ArrayList<>()));
                                        return item;
                                })
                                .collect(Collectors.toList());

                log.info("Returning {} files for user", fileItems.size());
                return new SystemFileListResponseDTO(fileItems);
        }
}
