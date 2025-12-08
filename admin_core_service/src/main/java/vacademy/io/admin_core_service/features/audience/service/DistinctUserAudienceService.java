package vacademy.io.admin_core_service.features.audience.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.audience.dto.combined.*;
import vacademy.io.admin_core_service.features.audience.enums.CustomFieldValueSourceType;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;
import vacademy.io.admin_core_service.features.common.entity.InstituteCustomField;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldRepository;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.common.repository.InstituteCustomFieldRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.*;
import java.util.stream.Collectors;


@Service
public class DistinctUserAudienceService {

    private static final Logger logger = LoggerFactory.getLogger(DistinctUserAudienceService.class);

    @Autowired
    private InstituteStudentRepository instituteStudentRepository;

    @Autowired
    private AudienceRepository audienceRepository;

    @Autowired
    private AudienceResponseRepository audienceResponseRepository;

    @Autowired
    private CustomFieldValuesRepository customFieldValuesRepository;

    @Autowired
    private CustomFieldRepository customFieldRepository;

    @Autowired
    private InstituteCustomFieldRepository instituteCustomFieldRepository;

    @Autowired
    private AuthService authService;

    /**
     * Get all users for an institute (from both institute users and audience respondents)
     * with their custom fields
     */
    public CombinedUserAudienceResponseDTO getCombinedUsersWithCustomFields(CombinedUserAudienceRequestDTO request) {
        logger.info("Getting combined users for institute: {}", request.getInstituteId());

        // Determine which sources to include (default: both if not specified)
        boolean includeInstituteUsers = request.getIncludeInstituteUsers() == null || request.getIncludeInstituteUsers();
        boolean includeAudienceRespondents = request.getIncludeAudienceRespondents() == null || request.getIncludeAudienceRespondents();

        // Step 1: Get user IDs from institute users (if requested)
        List<String> instituteUserIds = new ArrayList<>();
        if (includeInstituteUsers) {
            instituteUserIds = instituteStudentRepository.findDistinctUserIdsByInstituteId(request.getInstituteId());
            logger.info("Found {} institute users", instituteUserIds.size());
        } else {
            logger.info("Skipping institute users (includeInstituteUsers = false)");
        }

        // Step 2: Get audience IDs based on filters
        List<String> audienceIds = new ArrayList<>();
        if (includeAudienceRespondents) {
            CampaignFilterDTO campaignFilter = request.getCampaignFilter();
            
            if (campaignFilter != null && !CollectionUtils.isEmpty(campaignFilter.getAudienceIds())) {
                // Use specific audience IDs if provided
                audienceIds = campaignFilter.getAudienceIds();
                logger.info("Using filtered audience IDs: {}", audienceIds.size());
            } else {
                // Apply campaign filters to get audience IDs
                audienceIds = audienceRepository.findAudienceIdsWithFilters(
                        request.getInstituteId(),
                        campaignFilter != null ? campaignFilter.getCampaignName() : null,
                        campaignFilter != null ? campaignFilter.getCampaignStatus() : null,
                        campaignFilter != null ? campaignFilter.getCampaignType() : null,
                        campaignFilter != null ? campaignFilter.getStartDateFromLocal() : null,
                        campaignFilter != null && campaignFilter.getStartDateFromLocal() != null,
                        campaignFilter != null ? campaignFilter.getStartDateToLocal() : null,
                        campaignFilter != null && campaignFilter.getStartDateToLocal() != null
                );
                logger.info("Found {} audiences matching filters", audienceIds.size());
            }
        } else {
            logger.info("Skipping audience respondents (includeAudienceRespondents = false)");
        }

        // Step 3: Get all user IDs from audience responses
        List<String> audienceRespondentUserIds = new ArrayList<>();
        if (includeAudienceRespondents && !CollectionUtils.isEmpty(audienceIds)) {
            audienceRespondentUserIds = audienceResponseRepository.findDistinctUserIdsByAudienceIds(audienceIds);
            logger.info("Found {} audience respondents", audienceRespondentUserIds.size());
        }

        // Step 4: Merge and deduplicate user IDs
        Set<String> allUserIds = new LinkedHashSet<>();
        Set<String> instituteUserIdSet = new HashSet<>(instituteUserIds);
        Set<String> audienceRespondentUserIdSet = new HashSet<>(audienceRespondentUserIds);
        
        allUserIds.addAll(instituteUserIds);
        allUserIds.addAll(audienceRespondentUserIds);
        
        logger.info("Total unique users after deduplication: {}", allUserIds.size());

        if (allUserIds.isEmpty()) {
            return CombinedUserAudienceResponseDTO.builder()
                    .users(new ArrayList<>())
                    .totalElements(0L)
                    .totalPages(0)
                    .currentPage(request.getPage() != null ? request.getPage() : 0)
                    .pageSize(request.getSize() != null ? request.getSize() : 20)
                    .isLast(true)
                    .filteredAudienceIds(audienceIds)
                    .build();
        }

        // Step 5: Fetch full user details from auth service
        List<UserDTO> userDTOs = authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(allUserIds));
        logger.info("Fetched {} user details from auth service", userDTOs.size());

        // Create a map for quick lookup
        Map<String, UserDTO> userIdToUserDTO = userDTOs.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toMap(UserDTO::getId, u -> u, (a, b) -> a));

        // Step 6: Fetch all custom fields for these users
        Map<String, List<CustomFieldDTO>> userIdToCustomFields = fetchCustomFieldsForUsers(
                request.getInstituteId(), 
                new ArrayList<>(allUserIds)
        );

        // Step 7: Build response DTOs
        List<UserWithCustomFieldsDTO> users = new ArrayList<>();
        for (String userId : allUserIds) {
            UserDTO userDTO = userIdToUserDTO.get(userId);
            if (userDTO == null) {
                continue; // Skip if user not found
            }

            UserWithCustomFieldsDTO userWithCustomFields = UserWithCustomFieldsDTO.builder()
                    .user(userDTO)
                    .isInstituteUser(instituteUserIdSet.contains(userId))
                    .isAudienceRespondent(audienceRespondentUserIdSet.contains(userId))
                    .customFields(userIdToCustomFields.getOrDefault(userId, new ArrayList<>()))
                    .build();

            users.add(userWithCustomFields);
        }

        // Step 8: Apply filters
        users = applyFilters(users, request);

        // Step 9: Sort
        users = applySorting(users, request);

        // Step 10: Apply pagination
        int page = request.getPage() != null ? request.getPage() : 0;
        int size = request.getSize() != null ? request.getSize() : 20;
        
        int totalElements = users.size();
        int totalPages = (int) Math.ceil((double) totalElements / size);
        int fromIndex = page * size;
        int toIndex = Math.min(fromIndex + size, totalElements);
        
        List<UserWithCustomFieldsDTO> paginatedUsers = fromIndex < totalElements 
                ? users.subList(fromIndex, toIndex) 
                : new ArrayList<>();

        logger.info("Returning {} users (page {} of {})", paginatedUsers.size(), page, totalPages);

        return CombinedUserAudienceResponseDTO.builder()
                .users(paginatedUsers)
                .totalElements((long) totalElements)
                .totalPages(totalPages)
                .currentPage(page)
                .pageSize(size)
                .isLast(page >= totalPages - 1)
                .filteredAudienceIds(audienceIds)
                .build();
    }

    /**
     * Fetch custom fields for all users based on institute custom field definitions
     * Returns ALL institute custom fields for each user (with null values if not set)
     */
    private Map<String, List<CustomFieldDTO>> fetchCustomFieldsForUsers(String instituteId, List<String> userIds) {
        if (CollectionUtils.isEmpty(userIds)) {
            return new HashMap<>();
        }

        // Step 1: Fetch ALL active custom field definitions for the institute
        List<Object[]> instituteCustomFieldsData = instituteCustomFieldRepository
                .findAllActiveCustomFieldsWithDetailsByInstituteId(instituteId);
        
        logger.info("Found {} active custom field definitions for institute", instituteCustomFieldsData.size());

        // Build a template list of all custom fields (ordered and deduplicated by custom_field_id)
        Map<String, CustomFieldDTO> uniqueCustomFieldsMap = new LinkedHashMap<>();
        Map<String, CustomFields> customFieldIdToDefinition = new HashMap<>();
        
        for (Object[] data : instituteCustomFieldsData) {
            InstituteCustomField icf = (InstituteCustomField) data[0];
            CustomFields cf = (CustomFields) data[1];
            
            // Store the custom field definition
            customFieldIdToDefinition.put(cf.getId(), cf);
            
            // Only add if not already present (deduplication by custom_field_id)
            if (!uniqueCustomFieldsMap.containsKey(cf.getId())) {
                CustomFieldDTO templateDTO = CustomFieldDTO.builder()
                        .customFieldId(cf.getId())
                        .fieldKey(cf.getFieldKey())
                        .fieldName(cf.getFieldName())
                        .fieldType(cf.getFieldType())
                        .value(null)
                        .build();
                
                uniqueCustomFieldsMap.put(cf.getId(), templateDTO);
            }
        }
        
        // Convert to ordered list
        List<CustomFieldDTO> customFieldTemplate = new ArrayList<>(uniqueCustomFieldsMap.values());
        logger.info("Built template with {} unique custom fields", customFieldTemplate.size());

        // Step 2: Fetch actual custom field values for institute users (source_type = 'USER', source_id = user_id)
        List<CustomFieldValues> userCustomFieldValues = customFieldValuesRepository
                .findBySourceTypeAndSourceIdIn("USER", userIds);

        logger.info("Found {} custom field values for institute users", userCustomFieldValues.size());

        // Step 3: Fetch custom fields for audience responses
        List<String> responseIds = audienceResponseRepository.findResponseIdsByUserIds(userIds);
        logger.info("Found {} audience response IDs for users", responseIds.size());

        List<CustomFieldValues> audienceCustomFieldValues = new ArrayList<>();
        if (!CollectionUtils.isEmpty(responseIds)) {
            audienceCustomFieldValues = customFieldValuesRepository
                    .findBySourceTypeAndSourceIdIn("AUDIENCE_RESPONSE", responseIds);
            logger.info("Found {} custom field values for audience responses", audienceCustomFieldValues.size());
        }

        // Step 4: Create a map from response_id to user_id for audience responses
        Map<String, String> responseIdToUserId = new HashMap<>();
        if (!CollectionUtils.isEmpty(responseIds)) {
            List<vacademy.io.admin_core_service.features.audience.entity.AudienceResponse> responses = 
                    audienceResponseRepository.findAllById(responseIds);
            responseIdToUserId = responses.stream()
                    .filter(ar -> ar.getUserId() != null)
                    .collect(Collectors.toMap(
                            vacademy.io.admin_core_service.features.audience.entity.AudienceResponse::getId, 
                            vacademy.io.admin_core_service.features.audience.entity.AudienceResponse::getUserId, 
                            (a, b) -> a));
        }

        // Step 5: Build a map of userId -> customFieldId -> value
        Map<String, Map<String, String>> userCustomFieldValueMap = new HashMap<>();
        
        // Process USER type custom field values
        for (CustomFieldValues cfv : userCustomFieldValues) {
            if (CustomFieldValueSourceType.USER.name().equals(cfv.getSourceType())) {
                String userId = cfv.getSourceId();
                userCustomFieldValueMap
                        .computeIfAbsent(userId, k -> new HashMap<>())
                        .put(cfv.getCustomFieldId(), cfv.getValue());
            }
        }
        
        // Process AUDIENCE_RESPONSE type custom field values
        for (CustomFieldValues cfv : audienceCustomFieldValues) {
            if (CustomFieldValueSourceType.AUDIENCE_RESPONSE.name().equals(cfv.getSourceType())) {
                String userId = responseIdToUserId.get(cfv.getSourceId());
                if (userId != null) {
                    userCustomFieldValueMap
                            .computeIfAbsent(userId, k -> new HashMap<>())
                            .put(cfv.getCustomFieldId(), cfv.getValue());
                }
            }
        }

        // Step 6: Build custom fields for each user using the template
        Map<String, List<CustomFieldDTO>> userIdToCustomFields = new HashMap<>();
        
        for (String userId : userIds) {
            List<CustomFieldDTO> userCustomFields = new ArrayList<>();
            Map<String, String> userValues = userCustomFieldValueMap.getOrDefault(userId, new HashMap<>());
            
            // For each custom field in template, create a DTO with actual value or null
            for (CustomFieldDTO template : customFieldTemplate) {
                String value = userValues.get(template.getCustomFieldId());
                
                CustomFieldDTO customFieldDTO = CustomFieldDTO.builder()
                        .customFieldId(template.getCustomFieldId())
                        .fieldKey(template.getFieldKey())
                        .fieldName(template.getFieldName())
                        .fieldType(template.getFieldType())
                        .value(value) // Will be null if not set
                        .build();
                
                userCustomFields.add(customFieldDTO);
            }
            
            userIdToCustomFields.put(userId, userCustomFields);
        }

        logger.info("Built custom fields for {} users with {} fields each", userIds.size(), customFieldTemplate.size());
        return userIdToCustomFields;
    }

    /**
     * Apply filters to the user list
     */
    private List<UserWithCustomFieldsDTO> applyFilters(List<UserWithCustomFieldsDTO> users, CombinedUserAudienceRequestDTO request) {
        List<UserWithCustomFieldsDTO> filtered = users;

        UserFilterDTO userFilter = request.getUserFilter();
        if (userFilter == null) {
            return filtered; // No filters to apply
        }

        // Name search
        if (StringUtils.hasText(userFilter.getNameSearch())) {
            String searchLower = userFilter.getNameSearch().toLowerCase();
            filtered = filtered.stream()
                    .filter(u -> u.getUser() != null && (
                            (u.getUser().getFullName() != null && u.getUser().getFullName().toLowerCase().contains(searchLower)) ||
                            (u.getUser().getUsername() != null && u.getUser().getUsername().toLowerCase().contains(searchLower)) ||
                            (u.getUser().getEmail() != null && u.getUser().getEmail().toLowerCase().contains(searchLower))))
                    .collect(Collectors.toList());
        }

        // Email filter
        if (!CollectionUtils.isEmpty(userFilter.getEmails())) {
            Set<String> emailSet = new HashSet<>(userFilter.getEmails());
            filtered = filtered.stream()
                    .filter(u -> u.getUser() != null && u.getUser().getEmail() != null && emailSet.contains(u.getUser().getEmail()))
                    .collect(Collectors.toList());
        }

        // Mobile number filter
        if (!CollectionUtils.isEmpty(userFilter.getMobileNumbers())) {
            Set<String> mobileSet = new HashSet<>(userFilter.getMobileNumbers());
            filtered = filtered.stream()
                    .filter(u -> u.getUser() != null && u.getUser().getMobileNumber() != null && mobileSet.contains(u.getUser().getMobileNumber()))
                    .collect(Collectors.toList());
        }

        // Region filter
        if (!CollectionUtils.isEmpty(userFilter.getRegions())) {
            Set<String> regionSet = new HashSet<>(userFilter.getRegions());
            filtered = filtered.stream()
                    .filter(u -> u.getUser() != null && u.getUser().getRegion() != null && regionSet.contains(u.getUser().getRegion()))
                    .collect(Collectors.toList());
        }

        // Gender filter
        if (!CollectionUtils.isEmpty(userFilter.getGenders())) {
            Set<String> genderSet = new HashSet<>(userFilter.getGenders());
            filtered = filtered.stream()
                    .filter(u -> u.getUser() != null && u.getUser().getGender() != null && genderSet.contains(u.getUser().getGender()))
                    .collect(Collectors.toList());
        }

        return filtered;
    }

    /**
     * Apply sorting to the user list
     */
    private List<UserWithCustomFieldsDTO> applySorting(List<UserWithCustomFieldsDTO> users, CombinedUserAudienceRequestDTO request) {
        String sortBy = request.getSortBy();
        String sortDirection = request.getSortDirection();

        if (!StringUtils.hasText(sortBy)) {
            sortBy = "created_at";
        }
        if (!StringUtils.hasText(sortDirection)) {
            sortDirection = "DESC";
        }

        boolean ascending = "ASC".equalsIgnoreCase(sortDirection);

        Comparator<UserWithCustomFieldsDTO> comparator;
        switch (sortBy.toLowerCase()) {
            case "full_name":
            case "name":
                comparator = Comparator.comparing(u -> u.getUser() != null && u.getUser().getFullName() != null ? u.getUser().getFullName() : "", 
                        String.CASE_INSENSITIVE_ORDER);
                break;
            case "email":
                comparator = Comparator.comparing(u -> u.getUser() != null && u.getUser().getEmail() != null ? u.getUser().getEmail() : "", 
                        String.CASE_INSENSITIVE_ORDER);
                break;
            case "mobile_number":
                comparator = Comparator.comparing(u -> u.getUser() != null && u.getUser().getMobileNumber() != null ? u.getUser().getMobileNumber() : "");
                break;
            default:
                // Since createdAt is not available in UserDTO, sort by userId as fallback
                comparator = Comparator.comparing(u -> u.getUser() != null && u.getUser().getId() != null ? u.getUser().getId() : "");
                break;
        }

        if (!ascending) {
            comparator = comparator.reversed();
        }

        return users.stream().sorted(comparator).collect(Collectors.toList());
    }
}
