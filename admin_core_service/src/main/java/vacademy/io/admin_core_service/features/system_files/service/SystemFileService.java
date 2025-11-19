package vacademy.io.admin_core_service.features.system_files.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
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

                // Add view access
                if (request.getViewAccess() != null && !request.getViewAccess().isEmpty()) {
                        for (AccessDTO accessDTO : request.getViewAccess()) {
                                validateAccessLevel(accessDTO.getLevel());
                                accessList.add(createEntityAccess(savedSystemFile.getId(),
                                                AccessTypeEnum.view.name(), accessDTO.getLevel(),
                                                accessDTO.getLevelId()));
                        }
                }

                // Add edit access
                if (request.getEditAccess() != null && !request.getEditAccess().isEmpty()) {
                        for (AccessDTO accessDTO : request.getEditAccess()) {
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

        @Transactional(readOnly = true)
        public SystemFileListResponseDTO getSystemFilesByAccess(SystemFileListRequestDTO request, String instituteId,
                        CustomUserDetails user) {
                log.info("Getting system files for level: {}, levelId: {}, accessType: {}, institute: {}",
                                request.getLevel(), request.getLevelId(), request.getAccessType(), instituteId);

                // Validate access level
                validateAccessLevel(request.getLevel());

                // Validate access type if provided
                if (request.getAccessType() != null && !request.getAccessType().trim().isEmpty()) {
                        validateAccessType(request.getAccessType());
                }

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

                // Filter by institute and active status
                List<SystemFile> filteredFiles = systemFiles.stream()
                                .filter(file -> file.getInstituteId().equals(instituteId) &&
                                                file.getStatus().equals(StatusEnum.ACTIVE.name()))
                                .collect(Collectors.toList());

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
                        // Query to get all package_session_ids (batch_ids) for the user in the
                        // institute
                        List<vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping> mappings = studentSessionInstituteGroupMappingRepository
                                        .findAll();

                        return mappings.stream()
                                        .filter(m -> m.getUserId() != null && m.getUserId().equals(userId))
                                        .filter(m -> m.getInstitute() != null
                                                        && m.getInstitute().getId().equals(instituteId))
                                        .filter(m -> m.getPackageSession() != null)
                                        .map(m -> m.getPackageSession().getId())
                                        .distinct()
                                        .collect(Collectors.toList());
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
}
