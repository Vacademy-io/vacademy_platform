package vacademy.io.admin_core_service.features.audience.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.audience.dto.*;
import vacademy.io.admin_core_service.features.audience.entity.Audience;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldTypeEnum;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldRepository;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;
import vacademy.io.admin_core_service.features.notification.entity.NotificationEventConfig;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationSourceType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationTemplateType;
import vacademy.io.admin_core_service.features.notification.repository.NotificationEventConfigRepository;
import vacademy.io.admin_core_service.features.notification.dto.NotificationTemplateVariables;
import vacademy.io.admin_core_service.features.notification_service.service.SendUniqueLinkService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for managing Audience campaigns and lead submissions
 * Follows the same pattern as EnrollInviteService
 */
@Service
public class AudienceService {

    private static final Logger logger = LoggerFactory.getLogger(AudienceService.class);

    @Autowired
    private AudienceRepository audienceRepository;

    @Autowired
    private AudienceResponseRepository audienceResponseRepository;

    @Autowired
    private InstituteCustomFiledService instituteCustomFiledService;

    @Autowired
    private CustomFieldValuesRepository customFieldValuesRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private CustomFieldRepository customFieldRepository;

    @Autowired
    private NotificationEventConfigRepository notificationEventConfigRepository;

    @Autowired
    private SendUniqueLinkService sendUniqueLinkService;

    public List<String> getConvertedUserIdsByCampaign(String audienceId, String instituteId) {
        logger.info("Getting converted user IDs for campaign: {} (institute: {})", audienceId, instituteId);
        
        // Validate audience exists and belongs to institute (security check)
        audienceRepository.findByIdAndInstituteId(audienceId, instituteId)
                .orElseThrow(() -> new VacademyException("Campaign not found or doesn't belong to institute: " + audienceId));
        
        // Fetch all converted leads (user_id IS NOT NULL)
        List<AudienceResponse> convertedLeads = audienceResponseRepository.findConvertedLeads(audienceId);
        
        // Extract user IDs
        List<String> userIds = convertedLeads.stream()
                .map(AudienceResponse::getUserId)
                .filter(userId -> userId != null && !userId.isBlank())
                .distinct()
                .collect(Collectors.toList());
        
        logger.info("Found {} converted users for campaign: {}", userIds.size(), audienceId);
        return userIds;
    }

    /**
     * Create a new audience campaign with custom fields
     * Pattern: Same as EnrollInviteService.createEnrollInvite()
     */
    @Transactional
    public String createCampaign(AudienceDTO audienceDTO) {
        logger.info("Creating audience campaign: {}", audienceDTO.getCampaignName());

        // Validation
        if (audienceDTO == null) {
            throw new VacademyException("Audience payload cannot be null");
        }
        if (!StringUtils.hasText(audienceDTO.getInstituteId())) {
            throw new VacademyException("Institute ID is required");
        }
        if (!StringUtils.hasText(audienceDTO.getCampaignName())) {
            throw new VacademyException("Campaign name is required");
        }

        // Set default values
        if (!StringUtils.hasText(audienceDTO.getStatus())) {
            audienceDTO.setStatus("ACTIVE");
        }

        // 1. Create and save audience entity
        Audience audienceToSave = new Audience(audienceDTO);
        final Audience savedAudience = audienceRepository.save(audienceToSave);

        logger.info("Saved audience with ID: {}", savedAudience.getId());

        // 2. Link custom fields - EXACTLY like EnrollInvite!
        if (!CollectionUtils.isEmpty(audienceDTO.getInstituteCustomFields())) {
            List<InstituteCustomFieldDTO> customFieldsToSave = audienceDTO.getInstituteCustomFields().stream()
                    .filter(Objects::nonNull)
                    .peek(cf -> {
                        cf.setType(CustomFieldTypeEnum.AUDIENCE_FORM.name());
                        cf.setTypeId(savedAudience.getId());
                    })
                    .collect(Collectors.toList());

            // Reuse existing service!
            instituteCustomFiledService.addOrUpdateCustomField(customFieldsToSave);
            logger.info("Linked {} custom fields to audience {}", customFieldsToSave.size(), savedAudience.getId());
        }

        return savedAudience.getId();
    }

    /**
     * Update an existing audience campaign
     */
    @Transactional
    public String updateCampaign(String audienceId, AudienceDTO audienceDTO) {
        logger.info("Updating audience campaign: {}", audienceId);

        Audience audience = audienceRepository.findById(audienceId)
                .orElseThrow(() -> new VacademyException("Audience not found with ID: " + audienceId));

        // Security: Ensure institute ID matches
        if (!audience.getInstituteId().equals(audienceDTO.getInstituteId())) {
            throw new VacademyException("Institute ID mismatch");
        }

        // Update fields
        if (StringUtils.hasText(audienceDTO.getCampaignName())) {
            audience.setCampaignName(audienceDTO.getCampaignName());
        }
        if (StringUtils.hasText(audienceDTO.getDescription())) {
            audience.setDescription(audienceDTO.getDescription());
        }
        if (StringUtils.hasText(audienceDTO.getStatus())) {
            audience.setStatus(audienceDTO.getStatus());
        }
        if (StringUtils.hasText(audienceDTO.getCampaignType())) {
            audience.setCampaignType(audienceDTO.getCampaignType());
        }
        if (audienceDTO.getStartDateLocal() != null) {
            audience.setStartDate(audienceDTO.getStartDateLocal());
        }
        if (audienceDTO.getEndDateLocal() != null) {
            audience.setEndDate(audienceDTO.getEndDateLocal());
        }

        Audience updated = audienceRepository.save(audience);

        // Update custom fields if provided
        if (!CollectionUtils.isEmpty(audienceDTO.getInstituteCustomFields())) {
            List<InstituteCustomFieldDTO> customFieldsToSave = audienceDTO.getInstituteCustomFields().stream()
                    .filter(Objects::nonNull)
                    .peek(cf -> {
                        cf.setType(CustomFieldTypeEnum.AUDIENCE_FORM.name());
                        cf.setTypeId(updated.getId());
                    })
                    .collect(Collectors.toList());

            instituteCustomFiledService.addOrUpdateCustomField(customFieldsToSave);
        }

        logger.info("Updated audience: {}", updated.getId());
        return updated.getId();
    }

    /**
     * Get campaign by ID
     */
    public AudienceDTO getCampaignById(String audienceId, String instituteId) {
        Audience audience = audienceRepository.findByIdAndInstituteId(audienceId, instituteId)
                .orElseThrow(() -> new VacademyException("Audience not found"));

        // Get custom fields
        List<InstituteCustomFieldDTO> customFields = instituteCustomFiledService.findCustomFieldsAsJson(
                instituteId,
                CustomFieldTypeEnum.AUDIENCE_FORM.name(),
                audienceId
        );

        return AudienceDTO.builder()
                .id(audience.getId())
                .instituteId(audience.getInstituteId())
                .campaignName(audience.getCampaignName())
                .campaignType(audience.getCampaignType())
                .description(audience.getDescription())
                .campaignObjective(audience.getCampaignObjective())
                .startDateLocal(audience.getStartDate())
                .endDateLocal(audience.getEndDate())
                .status(audience.getStatus())
                .jsonWebMetadata(audience.getJsonWebMetadata())
                .createdByUserId(audience.getCreatedByUserId())
                .instituteCustomFields(customFields)
                .build();
    }

    /**
     * Get all campaigns for an institute with filters
     */
    public Page<AudienceDTO> getCampaigns(AudienceFilterDTO filterDTO) {
        Pageable pageable = PageRequest.of(
                filterDTO.getPage() != null ? filterDTO.getPage() : 0,
                filterDTO.getSize() != null ? filterDTO.getSize() : 20,
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<Audience> audiences = audienceRepository.findAudiencesWithFilters(
                filterDTO.getInstituteId(),
                filterDTO.getStatus(),
                filterDTO.getCampaignType(),
                filterDTO.getCampaignName(),
                filterDTO.getStartDateFromLocal(),
                filterDTO.getStartDateFromLocal() != null,
                filterDTO.getStartDateToLocal(),
                filterDTO.getStartDateToLocal() != null,
                pageable
        );

        return audiences.map(audience -> AudienceDTO.builder()
                .id(audience.getId())
                .instituteId(audience.getInstituteId())
                .campaignName(audience.getCampaignName())
                .campaignType(audience.getCampaignType())
                .description(audience.getDescription())
                .campaignObjective(audience.getCampaignObjective())
                .startDateLocal(audience.getStartDate())
                .endDateLocal(audience.getEndDate())
                .status(audience.getStatus())
                .jsonWebMetadata(audience.getJsonWebMetadata())
                .createdByUserId(audience.getCreatedByUserId())
                .build());
    }

    /**
     * Submit a lead from website form
     * Automatically creates/fetches user from auth_service
     */
    @Transactional
    public String submitLead(SubmitLeadRequestDTO requestDTO) {
        logger.info("Submitting lead for audience: {}", requestDTO.getAudienceId());

        // Validate audience exists
        Audience audience = audienceRepository.findById(requestDTO.getAudienceId())
                .orElseThrow(() -> new VacademyException("Audience not found"));

        // Validate audience is active
        if (!"ACTIVE".equals(audience.getStatus())) {
            throw new VacademyException("Audience campaign is not active");
        }
        String instituteId=audienceRepository.findById(requestDTO.getAudienceId()).get().getInstituteId();
        // 1. Create/fetch user from auth_service
        String userId = null;
        UserDTO createdUser = null;
        try {
            UserDTO userDTO = requestDTO.getUserDTO();
            if (userDTO != null && StringUtils.hasText(userDTO.getEmail())) {
                // Call auth_service to create or fetch existing user
                // sendCred = false (no email notification)
                createdUser = authService.createUserFromAuthService(
                        userDTO, 
                        audience.getInstituteId(), 
                        false  // Don't send credentials email
                );
                userId = createdUser.getId();
                // Prepare effectively final variables for lambda
                final UserDTO userForNotification = createdUser;
                final String instituteIdForNotification = instituteId;
                final String audienceInstituteId = audience.getInstituteId();

                // Duplicate submission guard: same audience + same user
                if (StringUtils.hasText(userId) &&
                        audienceResponseRepository.existsByAudienceIdAndUserId(requestDTO.getAudienceId(), userId)) {
                    return "You have already submitted your response for this campaign";
                }

                // Fetch the most recent EMAIL template config for this institute and event
                notificationEventConfigRepository
                        .findFirstByEventNameAndSourceTypeAndSourceIdAndTemplateTypeAndIsActiveTrueOrderByUpdatedAtDesc(
                                NotificationEventType.AUDIENCE_FORM_SUBMISSION,
                                NotificationSourceType.INSTITUTE,
                                instituteIdForNotification,
                                NotificationTemplateType.EMAIL
                        )
                        .ifPresent(config -> {
                            // Prepare dynamic variables (minimal user/institute info)
                            NotificationTemplateVariables templateVars = NotificationTemplateVariables.builder()
                                    .userFullName(userForNotification.getFullName())
                                    .userEmail(userForNotification.getEmail())
                                    .instituteId(audienceInstituteId)
                                    .build();
                            // Send email using template with dynamic parameters
                            sendUniqueLinkService.sendUniqueLinkByEmailByEnrollInvite(
                                    instituteIdForNotification,
                                    userForNotification,
                                    config.getTemplateId(),
                                    null,
                                    templateVars
                            );
                        });
                logger.info("User created/fetched from auth_service: {}", userId);

                // 2. Create audience response with user_id
                AudienceResponse response = AudienceResponse.builder()
                        .audienceId(requestDTO.getAudienceId())
                        .sourceType(requestDTO.getSourceType())
                        .sourceId(requestDTO.getSourceId())
                        .userId(userId) // Set user_id if created successfully
                        .build();

                AudienceResponse savedResponse = audienceResponseRepository.save(response);
                logger.info("Saved audience response with ID: {} and user_id: {}",
                        savedResponse.getId(), userId != null ? userId : "null");

                // 3. Save custom field values
                if (!CollectionUtils.isEmpty(requestDTO.getCustomFieldValues())) {
                    saveCustomFieldValues(
                            savedResponse.getId(),
                            requestDTO.getCustomFieldValues(),
                            audience.getInstituteId()
                    );
                }

                return savedResponse.getId();

            }
        } catch (Exception e) {
            logger.error("Error creating user in auth_service: {}", e.getMessage());

        }
        return "Error in submitting the response";


    }

    /**
     * Get all leads for a campaign with filters
     */
    public Page<LeadDetailDTO> getLeads(LeadFilterDTO filterDTO) {
        // Create Pageable without sorting since the query already has ORDER BY clause
        // Native queries don't map camelCase to snake_case automatically
        Pageable pageable = PageRequest.of(
                filterDTO.getPage() != null ? filterDTO.getPage() : 0,
                filterDTO.getSize() != null ? filterDTO.getSize() : 50
        );

        Page<AudienceResponse> responses = audienceResponseRepository.findLeadsWithFilters(
                filterDTO.getAudienceId(),
                filterDTO.getSourceType(),
                filterDTO.getSourceId(),
                filterDTO.getSubmittedFromLocal(),
                filterDTO.getSubmittedToLocal(),
                pageable
        );
        // Batch fetch UserDTOs for all userIds in this page
        Set<String> userIds = responses.getContent().stream()
                .map(AudienceResponse::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<String, UserDTO> userIdToUser = userIds.isEmpty() ? Collections.emptyMap() :
                authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(userIds))
                        .stream()
                        .filter(Objects::nonNull)
                        .collect(Collectors.toMap(UserDTO::getId, u -> u, (a, b) -> a));

        return responses.map(response -> {
            // Get custom field values for this response
            Map<String, String> customFieldValues = getCustomFieldValuesForResponse(response.getId());

            return LeadDetailDTO.builder()
                    .responseId(response.getId())
                    .audienceId(response.getAudienceId())
                    .userId(response.getUserId())
                    .user(StringUtils.hasText(response.getUserId()) ? userIdToUser.get(response.getUserId()) : null)
                    .sourceType(response.getSourceType())
                    .sourceId(response.getSourceId())
                    .submittedAtLocal(response.getSubmittedAt())
                    .customFieldValues(customFieldValues)
                    .build();
        });
    }

    /**
     * Get lead details by ID
     */
    public LeadDetailDTO getLeadById(String responseId) {
        AudienceResponse response = audienceResponseRepository.findById(responseId)
                .orElseThrow(() -> new VacademyException("Lead not found"));

        Audience audience = audienceRepository.findById(response.getAudienceId())
                .orElseThrow(() -> new VacademyException("Audience not found"));

        Map<String, String> customFieldValues = getCustomFieldValuesForResponse(response.getId());

        return LeadDetailDTO.builder()
                .responseId(response.getId())
                .audienceId(response.getAudienceId())
                .campaignName(audience.getCampaignName())
                .userId(response.getUserId())
                .sourceType(response.getSourceType())
                .sourceId(response.getSourceId())
                .submittedAtLocal(response.getSubmittedAt())
                .customFieldValues(customFieldValues)
                .build();
    }


    /**
     * Delete campaign (soft delete by setting status to ARCHIVED)
     */
    @Transactional
    public void deleteCampaign(String audienceId, String instituteId) {
        Audience audience = audienceRepository.findByIdAndInstituteId(audienceId, instituteId)
                .orElseThrow(() -> new VacademyException("Audience not found"));

        audience.setStatus("ARCHIVED");
        audienceRepository.save(audience);

        logger.info("Archived audience: {}", audienceId);
    }


    private void saveCustomFieldValues(String responseId, Map<String, String> fieldValues, String instituteId) {
        List<CustomFieldValues> customFieldValuesList = new ArrayList<>();

        for (Map.Entry<String, String> entry : fieldValues.entrySet()) {
            String fieldKey = entry.getKey();
            String value = entry.getValue();

            if (!StringUtils.hasText(value)) {
                continue; // Skip empty values
            }

            CustomFieldValues cfValue = CustomFieldValues.builder()
                    .sourceType("AUDIENCE_RESPONSE")
                    .sourceId(responseId)
                    .customFieldId(fieldKey) // This could be field key or field ID
                    .value(value)
                    .build();

            customFieldValuesList.add(cfValue);
        }

        if (!customFieldValuesList.isEmpty()) {
            customFieldValuesRepository.saveAll(customFieldValuesList);
            logger.info("Saved {} custom field values for response {}", customFieldValuesList.size(), responseId);
        }
    }

    /**
     * Get custom field values for a response
     */
    private Map<String, String> getCustomFieldValuesForResponse(String responseId) {
        List<CustomFieldValues> values = customFieldValuesRepository
                .findBySourceTypeAndSourceId("AUDIENCE_RESPONSE", responseId);

        return values.stream()
                .collect(Collectors.toMap(
                        CustomFieldValues::getCustomFieldId,
                        CustomFieldValues::getValue,
                        (v1, v2) -> v2 // In case of duplicate keys, take the latest
                ));
    }
}

