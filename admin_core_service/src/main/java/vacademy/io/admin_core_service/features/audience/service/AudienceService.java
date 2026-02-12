package vacademy.io.admin_core_service.features.audience.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.audience.dto.*;
import vacademy.io.admin_core_service.features.audience.dto.CounsellorAllocationSettingDTO;
import vacademy.io.admin_core_service.features.audience.entity.Audience;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.enums.CampaignStatusEnum;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.common.auth.dto.ParentWithChildDTO;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldTypeEnum;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldRepository;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.common.repository.InstituteCustomFieldRepository;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;
import vacademy.io.admin_core_service.features.enquiry.dto.EnquiryDTO;
import vacademy.io.admin_core_service.features.enquiry.entity.Enquiry;
import vacademy.io.admin_core_service.features.enquiry.entity.LinkedUsers;
import vacademy.io.admin_core_service.features.enquiry.repository.EnquiryRepository;
import vacademy.io.admin_core_service.features.enquiry.repository.LinkedUsersRepository;
import vacademy.io.admin_core_service.features.notification.entity.NotificationEventConfig;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationSourceType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationTemplateType;
import vacademy.io.admin_core_service.features.notification.repository.NotificationEventConfigRepository;
import vacademy.io.admin_core_service.features.notification.dto.NotificationTemplateVariables;
import vacademy.io.admin_core_service.features.notification_service.service.SendUniqueLinkService;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.notification.dto.GenericEmailRequest;
import vacademy.io.common.exceptions.VacademyException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.*;
import java.util.Random;
import java.util.stream.Collectors;
import vacademy.io.common.exceptions.VacademyException;

/**
 * Service for Audience Management
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

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private WorkflowTriggerService workflowTriggerService;

    @Autowired
    private InstituteCustomFieldRepository instituteCustomFieldRepository;

    @Autowired
    private vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository packageSessionRepository;

    @Autowired
    private EnquiryRepository enquiryRepository;

    @Autowired
    private LinkedUsersRepository linkedUsersRepository;

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    public List<String> getConvertedUserIdsByCampaign(String audienceId, String instituteId) {
        logger.info("Getting converted user IDs for campaign: {} (institute: {})", audienceId, instituteId);

        // Validate audience exists and belongs to institute (security check)
        audienceRepository.findByIdAndInstituteId(audienceId, instituteId)
                .orElseThrow(() -> new VacademyException(
                        "Campaign not found or doesn't belong to institute: " + audienceId));

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

    private void saveInstituteCustomFields(String audienceId, List<InstituteCustomFieldDTO> dtos) {
        if (!CollectionUtils.isEmpty(dtos)) {
            List<InstituteCustomFieldDTO> customFieldsToSave = dtos.stream()
                    .filter(Objects::nonNull)
                    .peek(cf -> {
                        cf.setId(null); // Force creation of new mapping
                        cf.setType(CustomFieldTypeEnum.AUDIENCE_FORM.name());
                        cf.setTypeId(audienceId);
                    })
                    .collect(Collectors.toList());
            instituteCustomFiledService.addOrUpdateCustomField(customFieldsToSave);
            logger.info("Linked {} custom fields to audience {}", customFieldsToSave.size(), audienceId);
        }
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
        saveInstituteCustomFields(savedAudience.getId(), audienceDTO.getInstituteCustomFields());

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
        if (StringUtils.hasText(audienceDTO.getSessionId())) {
            audience.setSessionId(audienceDTO.getSessionId());
        }
        if (StringUtils.hasText(audienceDTO.getSettingJson())) {
            audience.setSettingJson(audienceDTO.getSettingJson());
        }

        Audience updated = audienceRepository.save(audience);

        // Update custom fields if provided
        saveInstituteCustomFields(updated.getId(), audienceDTO.getInstituteCustomFields());

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
                audienceId);

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
                .toNotify(audience.getToNotify())
                .sendRespondentEmail(audience.getSendRespondentEmail())
                .sessionId(audience.getSessionId())
                .settingJson(audience.getSettingJson())
                .createdByUserId(audience.getCreatedByUserId())
                .instituteCustomFields(customFields)
                .build();
    }

    /**
     * Get all campaigns for an institute with filters
     */
    @Transactional(readOnly = true)
    public Page<AudienceDTO> getCampaigns(AudienceFilterDTO filterDTO) {
        Pageable pageable = PageRequest.of(
                filterDTO.getPage() != null ? filterDTO.getPage() : 0,
                filterDTO.getSize() != null ? filterDTO.getSize() : 20,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<Audience> audiences = audienceRepository.findAudiencesWithFilters(
                filterDTO.getInstituteId(),
                filterDTO.getStatus(),
                filterDTO.getCampaignType(),
                filterDTO.getCampaignName(),
                filterDTO.getStartDateFromLocal(),
                filterDTO.getStartDateFromLocal() != null,
                filterDTO.getStartDateToLocal(),
                filterDTO.getStartDateToLocal() != null,
                pageable);

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
                .toNotify(audience.getToNotify())
                .sendRespondentEmail(audience.getSendRespondentEmail())
                .sessionId(audience.getSessionId())
                .settingJson(audience.getSettingJson())
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
        String instituteId = audienceRepository.findById(requestDTO.getAudienceId()).get().getInstituteId();
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
                        false // Don't send credentials email
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
                            audience.getInstituteId());
                }

                // 4. Build custom field map for email
                Map<String, String> customFieldsForEmail = buildCustomFieldMapForEmail(savedResponse.getId());

                // 5. Send notification to respondent (if enabled)
                if (audience.getSendRespondentEmail() == null || audience.getSendRespondentEmail()) {
                    logger.info("Sending notification to respondent: {}", userForNotification.getEmail());

                    // Fetch the most recent EMAIL template config for this institute and event
                    Optional<NotificationEventConfig> configOpt = notificationEventConfigRepository
                            .findFirstByEventNameAndSourceTypeAndSourceIdAndTemplateTypeAndIsActiveTrueOrderByUpdatedAtDesc(
                                    NotificationEventType.AUDIENCE_FORM_SUBMISSION,
                                    NotificationSourceType.AUDIENCE,
                                    requestDTO.getAudienceId(),
                                    NotificationTemplateType.EMAIL);

                    if (configOpt.isPresent()) {
                        // Get current time with timezone
                        java.time.ZonedDateTime now = java.time.ZonedDateTime.now();
                        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter
                                .ofPattern("MMM dd, yyyy hh:mm a z");
                        String submissionTime = now.format(formatter);

                        // Send email using template with dynamic parameters
                        NotificationTemplateVariables templateVars = NotificationTemplateVariables.builder()
                                .userFullName(userForNotification.getFullName())
                                .userEmail(userForNotification.getEmail())
                                .instituteId(audienceInstituteId)
                                .campaignName(audience.getCampaignName())
                                .customFields(customFieldsForEmail)
                                .submissionTime(submissionTime)
                                .build();

                        sendUniqueLinkService.sendUniqueLinkByEmailByEnrollInvite(
                                instituteIdForNotification,
                                userForNotification,
                                configOpt.get().getTemplateId(),
                                null,
                                templateVars);
                        logger.info("Sent templated email to respondent: {}", userForNotification.getEmail());
                    } else {
                        // Send default plain email
                        String defaultEmailBody = buildDefaultEmailBody(
                                audience.getCampaignName(),
                                userForNotification.getFullName(),
                                userForNotification.getEmail(),
                                customFieldsForEmail);

                        logger.info("No template found, sending default email to: {}", userForNotification.getEmail());
                        logger.info("Default email body: {}", defaultEmailBody);

                        // Send default HTML email
                        GenericEmailRequest emailRequest = new GenericEmailRequest();
                        emailRequest.setTo(userForNotification.getEmail());
                        emailRequest.setSubject(
                                "Thank You for Submitting Your Response for Campaign -" + audience.getCampaignName());
                        emailRequest.setBody(defaultEmailBody);

                        try {
                            notificationService.sendGenericHtmlMail(emailRequest, instituteIdForNotification);
                            logger.info("Sent default email to respondent: {}", userForNotification.getEmail());
                        } catch (Exception ex) {
                            logger.error("Failed to send default email to {}: {}", userForNotification.getEmail(),
                                    ex.getMessage());
                        }
                    }
                }

                // 6. Send notifications to additional recipients (to_notify)
                if (StringUtils.hasText(audience.getToNotify())) {
                    String[] additionalEmails = audience.getToNotify().split(",");
                    logger.info("Sending notifications to {} additional recipients", additionalEmails.length);

                    for (String email : additionalEmails) {
                        String trimmedEmail = email.trim();
                        if (!StringUtils.hasText(trimmedEmail)) {
                            continue;
                        }

                        logger.info("Sending notification to additional recipient: {}", trimmedEmail);
                        String adminEmailBody = buildAdminNotificationBody(
                                audience.getCampaignName(),
                                userForNotification.getFullName(),
                                userForNotification.getEmail(),
                                customFieldsForEmail);

                        logger.info("No template found, sending default admin notification to: {}", trimmedEmail);
                        logger.info("Default admin email body: {}", adminEmailBody);

                        // Send default HTML email for admin
                        GenericEmailRequest adminEmailRequest = new GenericEmailRequest();
                        adminEmailRequest.setTo(trimmedEmail);
                        adminEmailRequest.setSubject("New Lead Submitted - " + audience.getCampaignName());
                        adminEmailRequest.setBody(adminEmailBody);

                        try {
                            notificationService.sendGenericHtmlMail(adminEmailRequest, instituteIdForNotification);
                            logger.info("Sent default admin notification to: {}", trimmedEmail);
                        } catch (Exception ex) {
                            logger.error("Failed to send admin notification to {}: {}", trimmedEmail, ex.getMessage());
                        }
                    }
                }

                return savedResponse.getId();

            }
        } catch (Exception e) {
            logger.error("Error creating user in auth_service: {}", e.getMessage());

        }
        return "Error in submitting the response";

    }

    /**
     * Submit a lead with workflow integration (v2)
     * Email sending is handled by workflow engine
     */
    @Transactional
    public String submitLeadV2(SubmitLeadRequestDTO requestDTO) {
        logger.info("[V2] Submitting lead for audience: {}", requestDTO.getAudienceId());

        // Validate audience exists
        Audience audience = audienceRepository.findById(requestDTO.getAudienceId())
                .orElseThrow(() -> new VacademyException("Audience not found"));

        // Validate audience is active
        if (!"ACTIVE".equals(audience.getStatus())) {
            throw new VacademyException("Audience campaign is not active");
        }

        String instituteId = audience.getInstituteId();

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
                        false // Don't send credentials email
                );
                userId = createdUser.getId();

                // Duplicate submission guard: same audience + same user
                if (StringUtils.hasText(userId) &&
                        audienceResponseRepository.existsByAudienceIdAndUserId(requestDTO.getAudienceId(), userId)) {
                    return "You have already submitted your response for this campaign";
                }

                // 2. Create audience response with user_id
                AudienceResponse response = AudienceResponse.builder()
                        .audienceId(requestDTO.getAudienceId())
                        .sourceType(requestDTO.getSourceType())
                        .sourceId(requestDTO.getSourceId())
                        .userId(userId)
                        .build();

                AudienceResponse savedResponse = audienceResponseRepository.save(response);
                logger.info("[V2] Saved audience response with ID: {} and user_id: {}",
                        savedResponse.getId(), userId);

                // 3. Save custom field values
                if (!CollectionUtils.isEmpty(requestDTO.getCustomFieldValues())) {
                    saveCustomFieldValues(
                            savedResponse.getId(),
                            requestDTO.getCustomFieldValues(),
                            audience.getInstituteId());
                }

                // 4. Build custom field map for email (to pass to workflow)
                Map<String, String> customFieldsForEmail = buildCustomFieldMapForEmail(savedResponse.getId());

                // Get current time with timezone
                java.time.ZonedDateTime now = java.time.ZonedDateTime.now();
                java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter
                        .ofPattern("MMM dd, yyyy hh:mm a z");
                String submissionTime = now.format(formatter);

                // 5. Generate complete email content (SIMPLIFIED APPROACH)
                // Build default respondent email body
                String respondentEmailBody = buildDefaultEmailBody(
                        audience.getCampaignName(),
                        createdUser.getFullName(),
                        createdUser.getEmail(),
                        customFieldsForEmail);
                String respondentEmailSubject = "Thank You for Submitting Your Response for Campaign - "
                        + audience.getCampaignName();

                // Build admin notification email body
                String adminEmailBody = buildAdminNotificationBody(
                        audience.getCampaignName(),
                        createdUser.getFullName(),
                        createdUser.getEmail(),
                        customFieldsForEmail);
                String adminEmailSubject = "New Lead Submitted - " + audience.getCampaignName();

                logger.info("[V2] Generated default email bodies for workflow");

                // 6. Parse admin notification recipients (toNotify)
                List<String> adminEmails = new ArrayList<>();
                if (StringUtils.hasText(audience.getToNotify())) {
                    String[] emails = audience.getToNotify().split(",");
                    for (String email : emails) {
                        String trimmedEmail = email.trim();
                        if (StringUtils.hasText(trimmedEmail)) {
                            adminEmails.add(trimmedEmail);
                        }
                    }
                    logger.info("[V2] Found {} admin notification recipients", adminEmails.size());
                }

                // 7. Build audience DTO for workflow context
                AudienceDTO audienceDTO = AudienceDTO.builder()
                        .id(audience.getId())
                        .campaignName(audience.getCampaignName())
                        .instituteId(audience.getInstituteId())
                        .status(audience.getStatus())
                        .toNotify(audience.getToNotify())
                        .sendRespondentEmail(audience.getSendRespondentEmail())
                        .build();

                // 8. Prepare context data for workflow (SIMPLIFIED)
                Map<String, Object> contextData = new HashMap<>();

                // User and audience data
                contextData.put("user", createdUser); // UserDTO object
                contextData.put("audience", audienceDTO); // Audience details
                contextData.put("audienceId", requestDTO.getAudienceId());
                contextData.put("instituteId", instituteId);
                contextData.put("customFields", customFieldsForEmail); // Map of custom field name -> value
                contextData.put("submissionTime", submissionTime);
                contextData.put("responseId", savedResponse.getId());
                contextData.put("campaignName", audience.getCampaignName());

                // Email sending configuration
                contextData.put("sendRespondentEmail",
                        audience.getSendRespondentEmail() == null || audience.getSendRespondentEmail());

                // Prepare respondent email request (List with single Map)
                List<Map<String, Object>> respondentEmailRequests = new ArrayList<>();
                Map<String, Object> respondentEmailRequest = new HashMap<>();
                respondentEmailRequest.put("to", createdUser.getEmail());
                respondentEmailRequest.put("subject", respondentEmailSubject);
                respondentEmailRequest.put("body", respondentEmailBody);
                respondentEmailRequests.add(respondentEmailRequest);
                contextData.put("respondentEmailRequests", respondentEmailRequests);

                logger.info("[V2] Prepared respondent email request: to={}, subject={}",
                        createdUser.getEmail(), respondentEmailSubject);

                // Prepare admin email requests (List of Maps, one per admin)
                List<Map<String, Object>> adminEmailRequests = new ArrayList<>();
                for (String adminEmail : adminEmails) {
                    Map<String, Object> adminEmailRequest = new HashMap<>();
                    adminEmailRequest.put("to", adminEmail);
                    adminEmailRequest.put("subject", adminEmailSubject);
                    adminEmailRequest.put("body", adminEmailBody);
                    adminEmailRequests.add(adminEmailRequest);
                }
                contextData.put("adminEmailRequests", adminEmailRequests);

                logger.info("[V2] Prepared {} admin email requests", adminEmailRequests.size());
                for (Map<String, Object> req : adminEmailRequests) {
                    logger.info("  - Admin email to: {}, subject: {}", req.get("to"), req.get("subject"));
                }

                logger.info(
                        "[V2] Triggering workflow for AUDIENCE_LEAD_SUBMISSION event. AudienceId: {}, InstituteId: {}, SendRespondentEmail: {}, AdminEmails: {}",
                        requestDTO.getAudienceId(), instituteId,
                        audience.getSendRespondentEmail() == null || audience.getSendRespondentEmail(),
                        adminEmails.size());

                // 9. Trigger the workflow
                workflowTriggerService.handleTriggerEvents(
                        WorkflowTriggerEvent.AUDIENCE_LEAD_SUBMISSION.name(),
                        requestDTO.getAudienceId(), // eventId (audience campaign ID)
                        instituteId,
                        contextData);

                logger.info("[V2] Workflow triggered successfully for audience: {}", requestDTO.getAudienceId());

                return savedResponse.getId();
            }
        } catch (Exception e) {
            logger.error("[V2] Error submitting lead: {}", e.getMessage(), e);
        }

        return "Error in submitting the response";
    }

    /**
     * Submit a lead with enquiry information
     * Creates enquiry entry first, then links it to audience response
     */
    @Transactional
    public SubmitLeadWithEnquiryResponseDTO submitLeadWithEnquiry(SubmitLeadWithEnquiryRequestDTO requestDTO) {
        logger.info("Submitting lead with enquiry for audience: {}", requestDTO.getAudienceId());

        // STEP 1: Validate audience campaign
        Audience audience = audienceRepository.findById(requestDTO.getAudienceId())
                .orElseThrow(() -> new VacademyException("Audience not found"));

        if (!"ACTIVE".equals(audience.getStatus())) {
            throw new VacademyException("Audience campaign is not active");
        }

        String instituteId = audience.getInstituteId();

        // STEP 2: Create parent and child users using batch endpoint
        String parentUserId = null;
        String childUserId = null; // Declare at method level for use in AudienceResponse builder
        UserDTO parentUserDTO = null;
        UserDTO childUserDTO = null;

        if (requestDTO.getParentUserDTO() != null && requestDTO.getChildUserDTO() != null) {
            // Validate and prepare child user DTO (generate email/name if missing)
            UserDTO preparedChildDTO = validateAndPrepareChildUserDTO(
                    requestDTO.getChildUserDTO(),
                    requestDTO.getParentUserDTO());

            List<UserDTO> userDTOs = List.of(requestDTO.getParentUserDTO(), preparedChildDTO);
            List<UserDTO> createdUsers = authService.createMultipleUsers(userDTOs, audience.getInstituteId(), false);

            if (createdUsers.size() != 2) {
                throw new VacademyException("Expected 2 users to be created (parent and child)");
            }

            parentUserDTO = createdUsers.get(0);
            childUserDTO = createdUsers.get(1);
            parentUserId = parentUserDTO.getId();
            childUserId = childUserDTO.getId(); // Assign child user ID

            logger.info("Created parent user with ID: {} and child user with ID: {}",
                    parentUserId, childUserId);

            // Duplicate submission guard - check if parent has already submitted
            if (StringUtils.hasText(parentUserId) &&
                    audienceResponseRepository.existsByAudienceIdAndUserId(requestDTO.getAudienceId(), parentUserId)) {
                throw new VacademyException("You have already submitted your response for this campaign");
            }
        } else {
            throw new VacademyException("Both parent and child user information are required");
        }

        // STEP 3: Create Enquiry Entry
        UUID enquiryId = null;
        Enquiry enquiry = null;
        if (requestDTO.getEnquiry() != null) {
            EnquiryDTO enquiryDTO = requestDTO.getEnquiry();
            String retrievalTrackingId = enquiryDTO.getEnquiryTrackingId();
            if (retrievalTrackingId == null || retrievalTrackingId.isEmpty()) {
                retrievalTrackingId = generateCustomTrackingId();
            }

            enquiry = Enquiry.builder()
                    .checklist(enquiryDTO.getChecklist())
                    .enquiryStatus(enquiryDTO.getEnquiryStatus())
                    .convertionStatus(enquiryDTO.getConvertionStatus())
                    .referenceSource(enquiryDTO.getReferenceSource())
                    .assignedUserId(enquiryDTO.getAssignedUserId())
                    .assignedVisitSessionId(enquiryDTO.getAssignedVisitSessionId())
                    .feeRangeExpectation(enquiryDTO.getFeeRangeExpectation())
                    .transportRequirement(enquiryDTO.getTransportRequirement())
                    .mode(enquiryDTO.getMode())
                    .enquiryTrackingId(retrievalTrackingId)
                    .interestScore(enquiryDTO.getInterestScore())
                    .notes(enquiryDTO.getNotes())
                    .build();

            Enquiry savedEnquiry = enquiryRepository.save(enquiry);
            enquiryId = savedEnquiry.getId();
            logger.info("Created enquiry with ID: {}", enquiryId);
        }

        // STEP 4: Create Audience Response Entry with new fields - store parent's
        // user_id and child's student_user_id
        AudienceResponse response = AudienceResponse.builder()
                .audienceId(requestDTO.getAudienceId())
                .sourceType(requestDTO.getSourceType())
                .sourceId(requestDTO.getSourceId())
                .userId(parentUserId) // Store parent's user_id
                .studentUserId(childUserId) // Store child's student_user_id
                .enquiryId(enquiryId != null ? enquiryId.toString() : null)
                .destinationPackageSessionId(requestDTO.getDestinationPackageSessionId())
                .parentName(requestDTO.getParentName())
                .parentEmail(requestDTO.getParentEmail())
                .parentMobile(requestDTO.getParentMobile())
                .overallStatus("ENQUIRY")
                .build();

        AudienceResponse savedResponse = audienceResponseRepository.save(response);
        logger.info("Saved audience response with ID: {} linked to enquiry: {} with parent user_id: {}",
                savedResponse.getId(), enquiryId, parentUserId);

        // Send Enquiry Confirmation Email
        if (audience.getSendRespondentEmail() == null || audience.getSendRespondentEmail()) {
            try {
                PackageSession packageSession = null;
                if (requestDTO.getDestinationPackageSessionId() != null) {
                    packageSession = packageSessionRepository.findById(requestDTO.getDestinationPackageSessionId())
                            .orElse(null);
                }

                sendEnquiryConfirmationEmail(
                        parentUserDTO,
                        childUserDTO,
                        audience,
                        enquiry,
                        packageSession);
            } catch (Exception e) {
                logger.error("Failed to send enquiry confirmation email", e);
            }
        }

        // STEP 5: Save custom field values (same as existing submitLead)
        if (!CollectionUtils.isEmpty(requestDTO.getCustomFieldValues())) {
            saveCustomFieldValues(
                    savedResponse.getId(),
                    requestDTO.getCustomFieldValues(),
                    audience.getInstituteId());
        }

        linkCounsellorToEnquiry(instituteId, requestDTO.getAudienceId(), enquiry, requestDTO.getCounsellorId());

        // STEP 6: Build custom field map for email
        Map<String, String> customFieldsForEmail = buildCustomFieldMapForEmail(savedResponse.getId());

        // STEP 8: Send notifications to additional recipients (toNotify)
        final UserDTO userForNotification = parentUserDTO; // Use parent user for notifications
        final String instituteIdForNotification = instituteId;

        if (StringUtils.hasText(audience.getToNotify())) {
            String[] additionalEmails = audience.getToNotify().split(",");
            logger.info("Sending notifications to {} additional recipients", additionalEmails.length);

            for (String email : additionalEmails) {
                String trimmedEmail = email.trim();
                if (!StringUtils.hasText(trimmedEmail)) {
                    continue;
                }

                logger.info("Sending notification to additional recipient: {}", trimmedEmail);
                String adminEmailBody = buildAdminNotificationBody(
                        audience.getCampaignName(),
                        userForNotification.getFullName(),
                        userForNotification.getEmail(),
                        customFieldsForEmail);

                GenericEmailRequest adminEmailRequest = new GenericEmailRequest();
                adminEmailRequest.setTo(trimmedEmail);
                adminEmailRequest.setSubject("New Lead Submitted - " + audience.getCampaignName());
                adminEmailRequest.setBody(adminEmailBody);

                try {
                    notificationService.sendGenericHtmlMail(adminEmailRequest, instituteIdForNotification);
                    logger.info("Sent default admin notification to: {}", trimmedEmail);
                } catch (Exception ex) {
                    logger.error("Failed to send admin notification to {}: {}", trimmedEmail, ex.getMessage());
                }
            }
        }

        // STEP 9: Build and return response
        return SubmitLeadWithEnquiryResponseDTO.builder()
                .enquiryId(enquiryId)
                .audienceResponseId(savedResponse.getId())
                .parentUserId(parentUserId) // Return parent user ID
                .counsellorId(requestDTO.getCounsellorId())
                .message("Lead and enquiry submitted successfully")
                .build();
    }

    private void linkCounsellorToEnquiry(String instituteId, String audienceId, Enquiry enquiry, String counsellorId) {
        logger.info("Processing counselor assignment for enquiry: {}", enquiry.getId());

        String finalCounsellorId = null;

        // CASE 1: Manual assignment - counsellorId provided in request
        if (StringUtils.hasText(counsellorId)) {
            finalCounsellorId = counsellorId;
            logger.info("Manual counselor assignment: {}", finalCounsellorId);
        }
        // CASE 2 & 3: Auto assignment
        else {
            // Priority 2: Check Campaign Settings
            CounsellorAllocationSettingDTO campaignSettings = parseCounsellorAllocationSettings(audienceId);
            boolean assignedFromCampaign = false;

            if (campaignSettings != null) {
                // If campaign explicitly enables auto-assign and has counselors
                if (Boolean.TRUE.equals(campaignSettings.getAutoAssignEnabled())
                        && campaignSettings.getCounsellorIds() != null
                        && !campaignSettings.getCounsellorIds().isEmpty()) {

                    finalCounsellorId = selectRandomCounselor(campaignSettings.getCounsellorIds());
                    assignedFromCampaign = true;
                    logger.info("Auto-assigned counselor from Campaign Settings: {}", finalCounsellorId);
                }
                // If autoAssignEnabled = false, we FALL THROUGH to institute (Campaign Opt-Out)
                // If list is empty, we FALL THROUGH to institute
            }

            // Priority 3: Check Institute Settings (Fallback if campaign didn't assign)
            if (!assignedFromCampaign) {
                logger.debug("Falling back to Institute Settings for counselor assignment");
                CounsellorAllocationSettingDTO instituteSettings = parseInstituteCounsellorSettings(instituteId);

                if (instituteSettings != null
                        && Boolean.TRUE.equals(instituteSettings.getAutoAssignEnabled())
                        && instituteSettings.getCounsellorIds() != null
                        && !instituteSettings.getCounsellorIds().isEmpty()) {

                    finalCounsellorId = selectRandomCounselor(instituteSettings.getCounsellorIds());
                    logger.info("Auto-assigned counselor from Institute Settings: {}", finalCounsellorId);
                } else {
                    logger.info("No counselor assigned from Institute Settings conditions not met");
                }
            }
        }

        // Final assignment
        if (finalCounsellorId != null) {
            // Validate counselor
            if (validateCounselor(finalCounsellorId, instituteId)) {
                // Create linked_users entry
                LinkedUsers linkedUser = LinkedUsers.builder()
                        .source("ENQUIRY")
                        .sourceId(enquiry.getId().toString())
                        .userId(finalCounsellorId)
                        .build();

                linkedUsersRepository.save(linkedUser);

                // Update enquiry assigned flag
                enquiry.setAssignedUserId(true);
                enquiryRepository.save(enquiry);

                logger.info("Successfully linked counselor {} to enquiry {}", finalCounsellorId, enquiry.getId());
            } else {
                logger.warn("Counselor validation failed for counselorId: {}", finalCounsellorId);
                enquiry.setAssignedUserId(false);
                enquiryRepository.save(enquiry);
            }
        } else {
            // CASE 3: No counselor assigned
            enquiry.setAssignedUserId(false);
            enquiryRepository.save(enquiry);
            logger.info("No counselor assigned to enquiry: {}", enquiry.getId());
        }
    }

    /**
     * Parse counselor allocation settings from audience setting_json
     */
    private CounsellorAllocationSettingDTO parseCounsellorAllocationSettings(String audienceId) {
        try {
            Audience audience = audienceRepository.findById(audienceId).orElse(null);
            if (audience == null || !StringUtils.hasText(audience.getSettingJson())) {
                logger.debug("No settings found for audience: {}", audienceId);
                return null;
            }

            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(audience.getSettingJson());

            JsonNode counsellorSettings = root
                    .path("SCHOOL_SETTING")
                    .path("data")
                    .path("COUNSELLOR_ALLOCATION_SETTING")
                    .path("data");

            if (counsellorSettings.isMissingNode()) {
                logger.debug("No counselor allocation settings found in JSON for audience: {}", audienceId);
                return null;
            }

            return mapper.treeToValue(counsellorSettings, CounsellorAllocationSettingDTO.class);
        } catch (Exception e) {
            logger.error("Failed to parse counselor allocation settings for audience: {}", audienceId, e);
            return null;
        }
    }

    /**
     * Parse counselor allocation settings from institute setting_json
     */
    private CounsellorAllocationSettingDTO parseInstituteCounsellorSettings(String instituteId) {
        try {
            Institute institute = instituteRepository.findById(instituteId).orElse(null);
            if (institute == null || !StringUtils.hasText(institute.getSetting())) {
                logger.debug("No settings found for institute: {}", instituteId);
                return null;
            }

            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(institute.getSetting());

            JsonNode counsellorSettings = root
                    .path("SCHOOL_SETTING")
                    .path("data")
                    .path("COUNSELLOR_ALLOCATION_SETTING")
                    .path("data");

            if (counsellorSettings.isMissingNode()) {
                logger.debug("No counselor allocation settings found in JSON for institute: {}", instituteId);
                return null;
            }

            return mapper.treeToValue(counsellorSettings, CounsellorAllocationSettingDTO.class);
        } catch (Exception e) {
            logger.error("Failed to parse counselor allocation settings for institute: {}", instituteId, e);
            return null;
        }
    }

    /**
     * Select random counselor from list
     */
    private String selectRandomCounselor(List<String> counsellorIds) {
        if (counsellorIds == null || counsellorIds.isEmpty()) {
            return null;
        }
        Random random = new Random();
        int index = random.nextInt(counsellorIds.size());
        return counsellorIds.get(index);
    }

    /**
     * Validate that the assigned user exists in the system
     * 
     * Design Decision: We only verify user existence, not role.
     * This allows any registered user (counselors, admins, managers, etc.) to be
     * assigned to enquiries.
     * The calling service is responsible for ensuring the appropriate user is
     * assigned.
     */
    private boolean validateCounselor(String counselorId, String instituteId) {
        if (!StringUtils.hasText(counselorId)) {
            logger.warn("User ID is null or empty");
            return false;
        }

        // Verify user exists via AuthService
        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(counselorId));
            if (users == null || users.isEmpty()) {
                logger.warn("User {} not found in auth service", counselorId);
                return false;
            }
            logger.debug("User {} validation passed - user exists", counselorId);
            return true;
        } catch (Exception e) {
            logger.error("Failed to validate user {}: {}", counselorId, e.getMessage());
            return false;
        }
    }

    /**
     * Validate and prepare child user DTO
     * Generates unique email and full name if not present
     * 
     * @param childUserDTO  Child user DTO from request
     * @param parentUserDTO Parent user DTO for reference
     * @return Validated and prepared child user DTO
     */
    private UserDTO validateAndPrepareChildUserDTO(UserDTO childUserDTO, UserDTO parentUserDTO) {
        if (childUserDTO == null) {
            throw new VacademyException("Child user information is required");
        }

        // Check and generate email if not present
        if (!StringUtils.hasText(childUserDTO.getEmail())) {
            // Generate unique email using UUID
            String uniqueEmail = "child_" + java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 12)
                    + "@noemail.vacademy.io";
            childUserDTO.setEmail(uniqueEmail);
            logger.info("Generated unique email for child: {}", uniqueEmail);
        }

        // Check and generate full name if not present
        if (!StringUtils.hasText(childUserDTO.getFullName())) {
            String parentName = StringUtils.hasText(parentUserDTO.getFullName())
                    ? parentUserDTO.getFullName()
                    : "Parent";
            String childFullName = "Child of " + parentName;
            childUserDTO.setFullName(childFullName);
            logger.info("Generated full name for child: {}", childFullName);
        }

        return childUserDTO;
    }

    /**
     * Get all leads for a campaign with filters
     */
    @Transactional(readOnly = true)
    public Page<LeadDetailDTO> getLeads(LeadFilterDTO filterDTO) {
        // Create Pageable without sorting since the query already has ORDER BY clause
        // Native queries don't map camelCase to snake_case automatically
        Pageable pageable = PageRequest.of(
                filterDTO.getPage() != null ? filterDTO.getPage() : 0,
                filterDTO.getSize() != null ? filterDTO.getSize() : 50);

        Page<AudienceResponse> responses = audienceResponseRepository.findLeadsWithFilters(
                filterDTO.getAudienceId(),
                filterDTO.getSourceType(),
                filterDTO.getSourceId(),
                filterDTO.getSubmittedFromLocal(),
                filterDTO.getSubmittedToLocal(),
                pageable);
        // Batch fetch UserDTOs for all userIds in this page
        Set<String> userIds = responses.getContent().stream()
                .map(AudienceResponse::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<String, UserDTO> userIdToUser = userIds.isEmpty() ? Collections.emptyMap()
                : authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(userIds))
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
    @Transactional(readOnly = true)
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

        audience.setStatus(CampaignStatusEnum.DELETED.name());
        audienceRepository.save(audience);

        logger.info("Deleted audience: {}", audienceId);
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

    /**
     * Build a map of custom field names to values for email template
     * Format: {field_name -> value}
     * Example: {"Phone Number" -> "1234567890", "Company Name" -> "Acme Corp"}
     */
    private Map<String, String> buildCustomFieldMapForEmail(String responseId) {
        // 1. Fetch saved custom field values for this response
        List<CustomFieldValues> savedValues = customFieldValuesRepository
                .findBySourceTypeAndSourceId("AUDIENCE_RESPONSE", responseId);

        if (CollectionUtils.isEmpty(savedValues)) {
            return Collections.emptyMap();
        }

        // 2. Extract custom_field_ids
        Set<String> customFieldIds = savedValues.stream()
                .map(CustomFieldValues::getCustomFieldId)
                .collect(Collectors.toSet());

        // 3. Fetch custom field definitions to get field_name (readable labels)
        List<CustomFields> fieldDefinitions = customFieldRepository.findAllById(customFieldIds);

        Map<String, String> fieldIdToName = fieldDefinitions.stream()
                .collect(Collectors.toMap(
                        CustomFields::getId,
                        CustomFields::getFieldName,
                        (a, b) -> a // In case of duplicates, take first
                ));

        // 4. Build the final map: field_name -> value
        Map<String, String> result = new HashMap<>();
        for (CustomFieldValues cfv : savedValues) {
            String fieldName = fieldIdToName.get(cfv.getCustomFieldId());
            if (StringUtils.hasText(fieldName) && StringUtils.hasText(cfv.getValue())) {
                result.put(fieldName, cfv.getValue());
            }
        }

        return result;
    }

    /**
     * Build default email body with custom fields - HTML formatted
     */
    private String buildDefaultEmailBody(String campaignName, String userName, String userEmail,
            Map<String, String> customFields) {
        StringBuilder emailBody = new StringBuilder();

        // Get current time with timezone
        java.time.ZonedDateTime now = java.time.ZonedDateTime.now();
        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter
                .ofPattern("MMM dd, yyyy hh:mm a z");
        String submissionTime = now.format(formatter);

        // HTML Email Template
        emailBody.append("<!DOCTYPE html>");
        emailBody.append("<html lang='en'>");
        emailBody.append("<head>");
        emailBody.append("<meta charset='UTF-8'>");
        emailBody.append("<meta name='viewport' content='width=device-width, initial-scale=1.0'>");
        emailBody.append("<style>");
        emailBody.append(
                "body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0; }");
        emailBody.append(
                ".container { max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }");
        emailBody
                .append(".header { background-color: #4a4a4a; color: white; padding: 30px 20px; text-align: center; }");
        emailBody.append(".header h1 { margin: 0; font-size: 24px; font-weight: 600; }");
        emailBody.append(".content { padding: 30px 20px; }");
        emailBody.append(".success-icon { text-align: center; margin-bottom: 20px; font-size: 48px; }");
        emailBody.append(
                ".message { color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 25px; text-align: center; }");
        emailBody.append(
                ".info-section { background-color: #f9f9f9; border-left: 4px solid #4a4a4a; padding: 15px 20px; margin: 20px 0; border-radius: 4px; }");
        emailBody.append(".info-section h3 { color: #4a4a4a; margin: 0 0 15px 0; font-size: 16px; font-weight: 600; }");
        emailBody.append(".info-item { display: flex; padding: 8px 0; border-bottom: 1px solid #e9ecef; }");
        emailBody.append(".info-item:last-child { border-bottom: none; }");
        emailBody.append(".info-label { font-weight: 600; color: #495057; min-width: 120px; }");
        emailBody.append(".info-value { color: #6c757d; flex: 1; }");
        emailBody.append(
                ".footer { background-color: #f9f9f9; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }");
        emailBody.append(".footer p { margin: 5px 0; }");
        emailBody.append("</style>");
        emailBody.append("</head>");
        emailBody.append("<body>");
        emailBody.append("<div class='container'>");

        // Header
        emailBody.append("<div class='header'>");
        emailBody.append("<h1>Form Submission Confirmation</h1>");
        emailBody.append("</div>");

        // Content
        emailBody.append("<div class='content'>");
        emailBody.append("<div class='success-icon'>✅</div>");
        emailBody.append("<div class='message'>");
        emailBody.append("Thank you for submitting the form for <strong>").append(campaignName)
                .append("</strong>.<br>");
        emailBody.append("We have received your information and will get back to you soon.");
        emailBody.append("</div>");

        // User Info Section
        emailBody.append("<div class='info-section'>");
        emailBody.append("<h3>Your Information</h3>");
        if (StringUtils.hasText(userName)) {
            emailBody.append("<div class='info-item'>");
            emailBody.append("<span class='info-label'>Name:</span>");
            emailBody.append("<span class='info-value'>").append(userName).append("</span>");
            emailBody.append("</div>");
        }
        if (StringUtils.hasText(userEmail)) {
            emailBody.append("<div class='info-item'>");
            emailBody.append("<span class='info-label'>Email:</span>");
            emailBody.append("<span class='info-value'>").append(userEmail).append("</span>");
            emailBody.append("</div>");
        }
        emailBody.append("<div class='info-item'>");
        emailBody.append("<span class='info-label'>Submitted:</span>");
        emailBody.append("<span class='info-value'>").append(submissionTime).append("</span>");
        emailBody.append("</div>");
        emailBody.append("</div>");

        // Custom Fields Section
        if (!CollectionUtils.isEmpty(customFields)) {
            emailBody.append("<div class='info-section'>");
            emailBody.append("<h3>Submitted Information</h3>");
            for (Map.Entry<String, String> entry : customFields.entrySet()) {
                emailBody.append("<div class='info-item'>");
                emailBody.append("<span class='info-label'>").append(entry.getKey()).append(":</span>");
                emailBody.append("<span class='info-value'>").append(entry.getValue()).append("</span>");
                emailBody.append("</div>");
            }
            emailBody.append("</div>");
        }

        emailBody.append("</div>");

        // Footer
        emailBody.append("<div class='footer'>");
        emailBody.append("<p>This is an automated message. Please do not reply to this email.</p>");
        emailBody.append("<p>&copy; 2025 All rights reserved.</p>");
        emailBody.append("</div>");

        emailBody.append("</div>");
        emailBody.append("</body>");
        emailBody.append("</html>");

        return emailBody.toString();
    }

    /**
     * Build notification email body for admin recipients (to_notify) - HTML
     * formatted
     */
    private String buildAdminNotificationBody(String campaignName, String userName, String userEmail,
            Map<String, String> customFields) {
        StringBuilder emailBody = new StringBuilder();

        // Get current time with timezone
        java.time.ZonedDateTime now = java.time.ZonedDateTime.now();
        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter
                .ofPattern("MMM dd, yyyy hh:mm a z");
        String submissionTime = now.format(formatter);

        // HTML Email Template for Admin
        emailBody.append("<!DOCTYPE html>");
        emailBody.append("<html lang='en'>");
        emailBody.append("<head>");
        emailBody.append("<meta charset='UTF-8'>");
        emailBody.append("<meta name='viewport' content='width=device-width, initial-scale=1.0'>");
        emailBody.append("<style>");
        emailBody.append(
                "body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0; }");
        emailBody.append(
                ".container { max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }");
        emailBody
                .append(".header { background-color: #2c3e50; color: white; padding: 30px 20px; text-align: center; }");
        emailBody.append(".header h1 { margin: 0; font-size: 24px; font-weight: 600; }");
        emailBody.append(
                ".badge { background-color: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 20px; display: inline-block; margin-top: 10px; font-size: 14px; }");
        emailBody.append(".content { padding: 30px 20px; }");
        emailBody.append(".alert-icon { text-align: center; margin-bottom: 20px; font-size: 48px; }");
        emailBody.append(
                ".message { color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 25px; text-align: center; }");
        emailBody.append(".campaign-name { color: #2c3e50; font-weight: 600; font-size: 18px; }");
        emailBody.append(
                ".info-section { background-color: #f9f9f9; border-left: 4px solid #2c3e50; padding: 15px 20px; margin: 20px 0; border-radius: 4px; }");
        emailBody.append(".info-section h3 { color: #2c3e50; margin: 0 0 15px 0; font-size: 16px; font-weight: 600; }");
        emailBody.append(".info-item { display: flex; padding: 8px 0; border-bottom: 1px solid #e9ecef; }");
        emailBody.append(".info-item:last-child { border-bottom: none; }");
        emailBody.append(".info-label { font-weight: 600; color: #495057; min-width: 140px; }");
        emailBody.append(".info-value { color: #6c757d; flex: 1; word-break: break-word; }");
        emailBody.append(
                ".action-section { background-color: #e8e8e8; padding: 20px; margin: 25px 0; border-radius: 8px; text-align: center; border-left: 4px solid #2c3e50; }");
        emailBody.append(".action-section p { color: #2c3e50; margin: 0; font-size: 14px; font-weight: 600; }");
        emailBody.append(
                ".footer { background-color: #f9f9f9; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }");
        emailBody.append(".footer p { margin: 5px 0; }");
        emailBody.append("</style>");
        emailBody.append("</head>");
        emailBody.append("<body>");
        emailBody.append("<div class='container'>");

        // Header
        emailBody.append("<div class='header'>");
        emailBody.append("<h1>🔔 New Lead Notification</h1>");
        emailBody.append("<div class='badge'>Admin Alert</div>");
        emailBody.append("</div>");

        // Content
        emailBody.append("<div class='content'>");
        emailBody.append("<div class='alert-icon'>🎯</div>");
        emailBody.append("<div class='message'>");
        emailBody.append("A new lead has been submitted for campaign:<br>");
        emailBody.append("<span class='campaign-name'>").append(campaignName).append("</span>");
        emailBody.append("</div>");

        // Lead Details Section
        emailBody.append("<div class='info-section'>");
        emailBody.append("<h3>Lead Details</h3>");
        if (StringUtils.hasText(userName)) {
            emailBody.append("<div class='info-item'>");
            emailBody.append("<span class='info-label'>Name:</span>");
            emailBody.append("<span class='info-value'>").append(userName).append("</span>");
            emailBody.append("</div>");
        }
        if (StringUtils.hasText(userEmail)) {
            emailBody.append("<div class='info-item'>");
            emailBody.append("<span class='info-label'>Email:</span>");
            emailBody.append("<span class='info-value'>").append(userEmail).append("</span>");
            emailBody.append("</div>");
        }
        emailBody.append("<div class='info-item'>");
        emailBody.append("<span class='info-label'>Submitted:</span>");
        emailBody.append("<span class='info-value'>").append(submissionTime).append("</span>");
        emailBody.append("</div>");
        emailBody.append("</div>");

        // Additional Information Section
        if (!CollectionUtils.isEmpty(customFields)) {
            emailBody.append("<div class='info-section'>");
            emailBody.append("<h3>Additional Information</h3>");
            for (Map.Entry<String, String> entry : customFields.entrySet()) {
                emailBody.append("<div class='info-item'>");
                emailBody.append("<span class='info-label'>").append(entry.getKey()).append(":</span>");
                emailBody.append("<span class='info-value'>").append(entry.getValue()).append("</span>");
                emailBody.append("</div>");
            }
            emailBody.append("</div>");
        }

        // Action Section
        emailBody.append("<div class='action-section'>");
        emailBody.append(
                "<p>💡 <strong>Action Required:</strong> Follow up with this lead as soon as possible to maximize conversion.</p>");
        emailBody.append("</div>");

        emailBody.append("</div>");

        // Footer
        emailBody.append("<div class='footer'>");
        emailBody.append("<p>This is an automated notification from your lead management system.</p>");
        emailBody.append("<p>&copy; 2025 All rights reserved.</p>");
        emailBody.append("</div>");

        emailBody.append("</div>");
        emailBody.append("</body>");
        emailBody.append("</html>");

        return emailBody.toString();
    }

    /**
     * Find user by phone number from custom field values
     * Searches in custom_field_values table and returns complete user with all
     * custom fields
     * If multiple users found, returns the latest one by created_at
     * 
     * @param phoneNumber Phone number to search for
     * @return UserWithCustomFieldsDTO containing complete user details and custom
     *         fields
     * @throws VacademyException if user not found
     */
    public UserWithCustomFieldsDTO getUserByPhoneNumber(String phoneNumber) {
        logger.info("Searching for user with phone number: {}", phoneNumber);

        // Step 1: Find all custom field values matching the phone number
        List<CustomFieldValues> matchingValues = customFieldValuesRepository.findByPhoneNumber(phoneNumber);

        if (matchingValues.isEmpty()) {
            logger.warn("No user found with phone number: {}", phoneNumber);
            throw new VacademyException("No user found with phone number: " + phoneNumber);
        }

        logger.info("Found {} custom field value records matching phone: {}", matchingValues.size(), phoneNumber);

        // Step 2: Extract user IDs from different source types
        Set<String> userIds = new HashSet<>();

        for (CustomFieldValues cfv : matchingValues) {
            String sourceType = cfv.getSourceType();
            String sourceId = cfv.getSourceId();

            if ("USER".equals(sourceType)) {
                // For USER type, source_id is the user_id directly
                userIds.add(sourceId);
                logger.debug("Found USER type: source_id={} is user_id", sourceId);
            } else if ("AUDIENCE_RESPONSE".equals(sourceType)) {
                // For AUDIENCE_RESPONSE type, source_id is response_id, need to get user_id
                Optional<AudienceResponse> responseOpt = audienceResponseRepository.findById(sourceId);
                if (responseOpt.isPresent() && responseOpt.get().getUserId() != null) {
                    userIds.add(responseOpt.get().getUserId());
                    logger.debug("Found AUDIENCE_RESPONSE type: source_id={}, user_id={}",
                            sourceId, responseOpt.get().getUserId());
                }
            }
        }

        if (userIds.isEmpty()) {
            logger.warn("No user IDs extracted from custom field values for phone: {}", phoneNumber);
            throw new VacademyException("No user found with phone number: " + phoneNumber);
        }

        logger.info("Extracted {} unique user IDs: {}", userIds.size(), userIds);

        // Step 3: If multiple users, get the latest one by created_at
        String selectedUserId;
        if (userIds.size() == 1) {
            selectedUserId = userIds.iterator().next();
            logger.info("Single user found: {}", selectedUserId);
        } else {
            // Get the latest user by finding the custom field value with latest created_at
            selectedUserId = matchingValues.stream()
                    .filter(cfv -> {
                        if ("USER".equals(cfv.getSourceType())) {
                            return userIds.contains(cfv.getSourceId());
                        } else if ("AUDIENCE_RESPONSE".equals(cfv.getSourceType())) {
                            Optional<AudienceResponse> resp = audienceResponseRepository.findById(cfv.getSourceId());
                            return resp.isPresent() && resp.get().getUserId() != null
                                    && userIds.contains(resp.get().getUserId());
                        }
                        return false;
                    })
                    .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                    .findFirst()
                    .map(cfv -> {
                        if ("USER".equals(cfv.getSourceType())) {
                            return cfv.getSourceId();
                        } else {
                            return audienceResponseRepository.findById(cfv.getSourceId())
                                    .map(AudienceResponse::getUserId)
                                    .orElse(null);
                        }
                    })
                    .orElseThrow(() -> new VacademyException("Could not determine latest user"));

            logger.info("Multiple users found ({}), selected latest: {}", userIds.size(), selectedUserId);
        }

        return buildUserWithCustomFields(selectedUserId);
    }

    /**
     * Get users by multiple phone numbers
     * Reuses the same logic as getUserByPhoneNumber but in batch
     * 
     * @param phoneNumbers List of phone numbers to search
     * @return List of UserWithCustomFieldsDTO (only includes found users)
     */
    public List<UserWithCustomFieldsDTO> getUsersByPhoneNumbers(List<String> phoneNumbers) {
        logger.info("Batch searching for {} phone numbers", phoneNumbers.size());

        List<UserWithCustomFieldsDTO> results = new ArrayList<>();

        for (String phoneNumber : phoneNumbers) {
            try {
                UserWithCustomFieldsDTO userDTO = getUserByPhoneNumber(phoneNumber);
                results.add(userDTO);
            } catch (VacademyException e) {
                // User not found - log and continue
                logger.warn("User not found for phone: {} - {}", phoneNumber, e.getMessage());
            }
        }

        logger.info("Found {} users out of {} phone numbers", results.size(), phoneNumbers.size());
        return results;
    }

    /**
     * Helper method to build UserWithCustomFieldsDTO from userId
     * Extracted for reuse in single and batch methods
     */
    private UserWithCustomFieldsDTO buildUserWithCustomFields(String selectedUserId) {
        // Step 4: Fetch complete user details from auth service
        UserDTO userDTO;
        try {
            userDTO = authService.getUsersFromAuthServiceByUserIds(List.of(selectedUserId)).get(0);
            logger.info("Fetched user details: id={}, email={}, name={}",
                    userDTO.getId(), userDTO.getEmail(), userDTO.getFullName());
        } catch (Exception e) {
            logger.error("Failed to fetch user details for userId: {}", selectedUserId, e);
            throw new VacademyException("Failed to fetch user details: " + e.getMessage());
        }

        // Step 5: Fetch all custom field values for this user (from both USER and
        // AUDIENCE_RESPONSE types)
        Map<String, String> customFieldsMap = new HashMap<>();

        // Get USER type custom fields
        List<CustomFieldValues> userCustomFields = customFieldValuesRepository
                .findBySourceTypeAndSourceId("USER", selectedUserId);

        for (CustomFieldValues cfv : userCustomFields) {
            // Get field key from custom_fields table
            Optional<CustomFields> customFieldOpt = customFieldRepository.findById(cfv.getCustomFieldId());
            if (customFieldOpt.isPresent()) {
                String fieldKey = customFieldOpt.get().getFieldName();
                customFieldsMap.put(fieldKey, cfv.getValue());
            }
        }

        logger.info("Found {} USER type custom fields", userCustomFields.size());

        // Get AUDIENCE_RESPONSE type custom fields
        List<AudienceResponse> userResponses = audienceResponseRepository.findByUserId(selectedUserId);
        for (AudienceResponse response : userResponses) {
            List<CustomFieldValues> responseCustomFields = customFieldValuesRepository
                    .findBySourceTypeAndSourceId("AUDIENCE_RESPONSE", response.getId());

            for (CustomFieldValues cfv : responseCustomFields) {
                Optional<CustomFields> customFieldOpt = customFieldRepository.findById(cfv.getCustomFieldId());
                if (customFieldOpt.isPresent()) {
                    String fieldKey = customFieldOpt.get().getFieldName();
                    // Don't override if already exists from USER type (USER takes precedence)
                    customFieldsMap.putIfAbsent(fieldKey, cfv.getValue());
                }
            }
        }

        logger.info("Total custom fields collected: {}", customFieldsMap.size());
        logger.debug("Custom fields: {}", customFieldsMap);

        // Step 6: Build and return response
        return UserWithCustomFieldsDTO.builder()
                .user(userDTO)
                .customFields(customFieldsMap)
                .build();
    }

    /**
     * Submit a lead from form webhook (Zoho Forms, Google Forms, Microsoft Forms)
     * Maps field_name to custom_field_id before saving
     * 
     * @param audienceId    The audience/campaign ID
     * @param processedData Processed form data containing field names and values
     * @param formProvider  The form provider (ZOHO_FORMS, GOOGLE_FORMS, etc.)
     * @return Response ID
     */
    @Transactional
    public String submitLeadFromFormWebhook(String audienceId, ProcessedFormDataDTO processedData,
            String formProvider) {
        logger.info("Submitting lead from form webhook: provider={}, audienceId={}", formProvider, audienceId);

        // Validate audience exists
        Audience audience = audienceRepository.findById(audienceId)
                .orElseThrow(() -> new VacademyException("Audience not found: " + audienceId));

        // Validate audience is active
        if (!"ACTIVE".equals(audience.getStatus())) {
            throw new VacademyException("Audience campaign is not active");
        }

        String instituteId = audience.getInstituteId();

        // Extract email from processed data
        String email = processedData.getEmail();
        if (!StringUtils.hasText(email)) {
            throw new VacademyException("Email is required for form submission");
        }

        // 1. Create/fetch user from auth_service
        UserDTO userDTO = UserDTO.builder()
                .email(email)
                .fullName(StringUtils.hasText(processedData.getFullName()) ? processedData.getFullName() : email)
                .mobileNumber(processedData.getPhone())
                .build();

        UserDTO createdUser = authService.createUserFromAuthService(userDTO, instituteId, false);
        String userId = createdUser.getId();

        // Ensure mobile number from form is preserved (auth service might return
        // existing user without mobile)
        if (!StringUtils.hasText(createdUser.getMobileNumber()) && StringUtils.hasText(processedData.getPhone())) {
            createdUser.setMobileNumber(processedData.getPhone());
            logger.info("Set mobile number from form data: {}", processedData.getPhone());
        }

        logger.info("User created/fetched: userId={}, email={}, mobile={}", userId, email,
                createdUser.getMobileNumber());

        // Duplicate submission guard
        if (audienceResponseRepository.existsByAudienceIdAndUserId(audienceId, userId)) {
            logger.warn("Duplicate submission for audienceId={}, userId={}", audienceId, userId);
            return "You have already submitted your response for this campaign";
        }

        // 2. Create audience response with calculated workflowActivateDayAt
        Timestamp workflowActivateDayAt = calculateWorkflowActivateDayAt(audience);

        AudienceResponse response = AudienceResponse.builder()
                .audienceId(audienceId)
                .sourceType(formProvider) // ZOHO_FORMS, GOOGLE_FORMS, etc.
                .sourceId(formProvider + "_WEBHOOK")
                .userId(userId)
                .workflowActivateDayAt(workflowActivateDayAt)
                .build();

        AudienceResponse savedResponse = audienceResponseRepository.save(response);
        logger.info("Saved audience response: responseId={}, userId={}", savedResponse.getId(), userId);

        // 3. Map field_name to custom_field_id and save custom field values
        if (processedData.getFormFields() != null && !processedData.getFormFields().isEmpty()) {
            saveCustomFieldValuesByFieldName(
                    savedResponse.getId(),
                    processedData.getFormFields(),
                    instituteId,
                    audienceId);
        }

        // 4. Build custom field map for workflow
        Map<String, String> customFieldsForEmail = buildCustomFieldMapForEmail(savedResponse.getId());

        // Get current time with timezone
        java.time.ZonedDateTime now = java.time.ZonedDateTime.now();
        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter
                .ofPattern("MMM dd, yyyy hh:mm a z");
        String submissionTime = now.format(formatter);

        // 5. Generate email content
        String respondentEmailBody = buildDefaultEmailBody(
                audience.getCampaignName(),
                createdUser.getFullName(),
                createdUser.getEmail(),
                customFieldsForEmail);
        String respondentEmailSubject = "Thank You for Submitting Your Response for Campaign - "
                + audience.getCampaignName();

        String adminEmailBody = buildAdminNotificationBody(
                audience.getCampaignName(),
                createdUser.getFullName(),
                createdUser.getEmail(),
                customFieldsForEmail);
        String adminEmailSubject = "New Lead Submitted - " + audience.getCampaignName();

        logger.info("Generated email bodies for workflow trigger");

        // 6. Parse admin notification recipients
        List<String> adminEmails = new ArrayList<>();
        if (StringUtils.hasText(audience.getToNotify())) {
            String[] emails = audience.getToNotify().split(",");
            for (String adminEmail : emails) {
                String trimmedEmail = adminEmail.trim();
                if (StringUtils.hasText(trimmedEmail)) {
                    adminEmails.add(trimmedEmail);
                }
            }
        }

        // 7. Build audience DTO for workflow
        AudienceDTO audienceDTO = AudienceDTO.builder()
                .id(audience.getId())
                .campaignName(audience.getCampaignName())
                .instituteId(audience.getInstituteId())
                .status(audience.getStatus())
                .toNotify(audience.getToNotify())
                .sendRespondentEmail(audience.getSendRespondentEmail())
                .build();

        // 8. Prepare context data for workflow
        Map<String, Object> contextData = new HashMap<>();
        contextData.put("user", createdUser);
        contextData.put("audience", audienceDTO);
        contextData.put("audienceId", audienceId);
        contextData.put("instituteId", instituteId);
        contextData.put("customFields", customFieldsForEmail);
        contextData.put("submissionTime", submissionTime);
        contextData.put("responseId", savedResponse.getId());
        contextData.put("campaignName", audience.getCampaignName());
        contextData.put("formProvider", formProvider);
        contextData.put("sendRespondentEmail",
                audience.getSendRespondentEmail() == null || audience.getSendRespondentEmail());

        // Prepare respondent email request
        List<Map<String, Object>> respondentEmailRequests = new ArrayList<>();
        Map<String, Object> respondentEmailRequest = new HashMap<>();
        respondentEmailRequest.put("to", createdUser.getEmail());
        respondentEmailRequest.put("subject", respondentEmailSubject);
        respondentEmailRequest.put("body", respondentEmailBody);
        respondentEmailRequests.add(respondentEmailRequest);
        contextData.put("respondentEmailRequests", respondentEmailRequests);

        // Prepare admin email requests
        List<Map<String, Object>> adminEmailRequests = new ArrayList<>();
        for (String adminEmail : adminEmails) {
            Map<String, Object> adminEmailRequest = new HashMap<>();
            adminEmailRequest.put("to", adminEmail);
            adminEmailRequest.put("subject", adminEmailSubject);
            adminEmailRequest.put("body", adminEmailBody);
            adminEmailRequests.add(adminEmailRequest);
        }
        contextData.put("adminEmailRequests", adminEmailRequests);

        logger.info("Prepared {} admin email requests", adminEmailRequests.size());

        // 9. Trigger workflow
        try {
            workflowTriggerService.handleTriggerEvents(
                    WorkflowTriggerEvent.AUDIENCE_LEAD_SUBMISSION.name(),
                    audienceId,
                    instituteId,
                    contextData);
            logger.info("Workflow triggered successfully for form webhook submission");
        } catch (Exception e) {
            logger.error("Failed to trigger workflow for form webhook submission", e);
            // Don't throw exception - response is already saved
        }

        return savedResponse.getId();
    }

    private void saveCustomFieldValuesByFieldName(String responseId, Map<String, String> fieldNameValues,
            String instituteId, String audienceId) {
        logger.info("Mapping {} field names to custom field IDs for response: {}", fieldNameValues.size(), responseId);

        // Fetch institute custom fields for AUDIENCE_FORM type with this specific
        // audience (campaign)
        List<Object[]> instituteCustomFieldsData = instituteCustomFieldRepository.findInstituteCustomFieldsWithDetails(
                instituteId,
                CustomFieldTypeEnum.AUDIENCE_FORM.name(),
                audienceId);

        // Create a map: field_name (lowercase) -> custom_field_id
        Map<String, String> fieldNameToIdMap = new HashMap<>();
        for (Object[] row : instituteCustomFieldsData) {
            // row[0] = InstituteCustomField, row[1] = CustomFields
            CustomFields customField = (CustomFields) row[1];
            if (StringUtils.hasText(customField.getFieldName())) {
                fieldNameToIdMap.put(customField.getFieldName().toLowerCase().trim(), customField.getId());
                logger.debug("Mapped field_name '{}' to custom_field_id: {}", customField.getFieldName(),
                        customField.getId());
            }
        }

        logger.debug("Built field name to ID map with {} entries for audienceId: {}", fieldNameToIdMap.size(),
                audienceId);

        // Map field names to IDs and save
        List<CustomFieldValues> customFieldValuesList = new ArrayList<>();
        int mappedCount = 0;
        int unmappedCount = 0;

        for (Map.Entry<String, String> entry : fieldNameValues.entrySet()) {
            String fieldName = entry.getKey();
            String value = entry.getValue();

            if (!StringUtils.hasText(value)) {
                continue;
            }

            // Try to find custom field ID by field name (case-insensitive)
            String customFieldId = fieldNameToIdMap.get(fieldName.toLowerCase().trim());

            if (customFieldId != null) {
                CustomFieldValues cfValue = CustomFieldValues.builder()
                        .sourceType("AUDIENCE_RESPONSE")
                        .sourceId(responseId)
                        .customFieldId(customFieldId)
                        .value(value)
                        .build();

                customFieldValuesList.add(cfValue);
                mappedCount++;
                logger.debug("Mapped field '{}' to custom_field_id: {}", fieldName, customFieldId);
            } else {
                logger.warn("No custom field found for field_name: '{}' in audienceId: {} - skipping", fieldName,
                        audienceId);
                unmappedCount++;
            }
        }

        if (!customFieldValuesList.isEmpty()) {
            customFieldValuesRepository.saveAll(customFieldValuesList);
            logger.info("Saved {} custom field values for response {}. Mapped: {}, Unmapped: {}",
                    customFieldValuesList.size(), responseId, mappedCount, unmappedCount);
        } else {
            logger.warn("No custom field values to save - all {} fields were unmapped for audienceId: {}",
                    unmappedCount, audienceId);
        }
    }

    /**
     * Get enquiries with audience responses, user details and custom fields
     */
    @Transactional(readOnly = true)
    public Page<EnquiryWithResponseDTO> getEnquiriesWithResponses(EnquiryListFilterDTO filterDTO) {
        logger.info("Fetching enquiries with filters: {}", filterDTO);

        // Set default pagination if not provided
        int page = filterDTO.getPage() != null ? filterDTO.getPage() : 0;
        int size = filterDTO.getSize() != null ? filterDTO.getSize() : 20;
        Pageable pageable = PageRequest.of(page, size);

        // Fetch enquiries with filters
        Page<Enquiry> enquiries = enquiryRepository.findEnquiriesWithFilters(
                filterDTO.getAudienceId(),
                filterDTO.getStatus(),
                filterDTO.getSource(),
                filterDTO.getDestinationPackageSessionId(),
                filterDTO.getCreatedFrom(),
                filterDTO.getCreatedTo(),
                pageable);

        logger.info("Found {} enquiries", enquiries.getTotalElements());

        // Fetch all audience responses for enquiries
        List<String> enquiryIds = enquiries.getContent().stream()
                .map(e -> e.getId().toString())
                .collect(Collectors.toList());

        List<AudienceResponse> audienceResponses = audienceResponseRepository.findByEnquiryIdIn(enquiryIds);
        Map<String, AudienceResponse> responseMap = audienceResponses.stream()
                .collect(Collectors.toMap(AudienceResponse::getEnquiryId, ar -> ar));

        // Collect all user IDs for batch fetch
        Set<String> userIds = audienceResponses.stream()
                .map(AudienceResponse::getUserId)
                .filter(StringUtils::hasText)
                .collect(Collectors.toSet());

        // Batch fetch users WITH their linked children (parent-child relationship)
        Map<String, ParentWithChildDTO> userIdToParentWithChild = userIds.isEmpty()
                ? Collections.emptyMap()
                : authService.getUsersWithChildren(new ArrayList<>(userIds))
                        .stream()
                        .filter(Objects::nonNull)
                        .filter(pwc -> pwc.getParent() != null)
                        .collect(Collectors.toMap(
                                pwc -> pwc.getParent().getId(),
                                pwc -> pwc,
                                (a, b) -> a));

        logger.info("Fetched {} users with children for {} enquiries",
                userIdToParentWithChild.size(), enquiries.getContent().size());

        // Batch fetch custom field values for all audience responses (optimization)
        List<String> responseIds = audienceResponses.stream()
                .map(AudienceResponse::getId)
                .collect(Collectors.toList());

        Map<String, Map<String, String>> customFieldsMap = new HashMap<>();
        if (!responseIds.isEmpty()) {
            List<CustomFieldValues> allCustomFields = customFieldValuesRepository
                    .findBySourceTypeAndSourceIdIn("AUDIENCE_RESPONSE", responseIds);

            // Group by source_id (response_id)
            for (CustomFieldValues cfv : allCustomFields) {
                customFieldsMap
                        .computeIfAbsent(cfv.getSourceId(), k -> new HashMap<>())
                        .put(cfv.getCustomFieldId(), cfv.getValue());
            }
            logger.info("Fetched custom fields for {} responses", customFieldsMap.size());
        }

        // Batch fetch assigned counsellors from linked_users table
        Map<String, String> enquiryToCounsellorMap = enquiryIds.isEmpty() ? Collections.emptyMap()
                : linkedUsersRepository.findBySourceAndSourceIdIn("ENQUIRY", enquiryIds)
                        .stream()
                        .filter(lu -> StringUtils.hasText(lu.getUserId()))
                        .collect(Collectors.toMap(
                                LinkedUsers::getSourceId,
                                LinkedUsers::getUserId,
                                (a, b) -> a));

        logger.info("Fetched {} assigned counsellors for {} enquiries",
                enquiryToCounsellorMap.size(), enquiryIds.size());

        // Build DTOs with parent and child user information
        List<EnquiryWithResponseDTO> dtos = enquiries.getContent().stream()
                .map(enquiry -> {
                    AudienceResponse audienceResponse = responseMap.get(enquiry.getId().toString());

                    if (audienceResponse == null) {
                        logger.warn("No audience response found for enquiry: {}", enquiry.getId());
                        return buildEnquiryOnlyDTO(enquiry);
                    }

                    // Get parent and child from map
                    vacademy.io.common.auth.dto.ParentWithChildDTO parentWithChild = StringUtils
                            .hasText(audienceResponse.getUserId())
                                    ? userIdToParentWithChild.get(audienceResponse.getUserId())
                                    : null;

                    UserDTO userDTO = parentWithChild != null ? parentWithChild.getParent() : null;
                    UserDTO childUserDTO = parentWithChild != null ? parentWithChild.getChild() : null;

                    // Get custom fields from map (same as /leads)
                    Map<String, String> customFields = customFieldsMap.getOrDefault(
                            audienceResponse.getId(),
                            Collections.emptyMap());

                    // Get assigned counsellor from map
                    String assignedCounsellorId = enquiryToCounsellorMap.get(enquiry.getId().toString());

                    return EnquiryWithResponseDTO.builder()
                            // Enquiry fields
                            .enquiryId(enquiry.getId())
                            .checklist(enquiry.getChecklist())
                            .enquiryStatus(enquiry.getEnquiryStatus())
                            .convertionStatus(enquiry.getConvertionStatus())
                            .referenceSource(enquiry.getReferenceSource())
                            .assignedUserId(enquiry.getAssignedUserId())
                            .assignedVisitSessionId(enquiry.getAssignedVisitSessionId())
                            .feeRangeExpectation(enquiry.getFeeRangeExpectation())
                            .transportRequirement(enquiry.getTransportRequirement())
                            .mode(enquiry.getMode())
                            .enquiryTrackingId(enquiry.getEnquiryTrackingId())
                            .interestScore(enquiry.getInterestScore())
                            .notes(enquiry.getNotes())
                            .enquiryCreatedAt(enquiry.getCreatedAt())
                            // Audience Response fields
                            .audienceResponseId(audienceResponse.getId())
                            .audienceId(audienceResponse.getAudienceId())
                            .sourceType(audienceResponse.getSourceType())
                            .sourceId(audienceResponse.getSourceId())
                            .destinationPackageSessionId(audienceResponse.getDestinationPackageSessionId())
                            .parentName(audienceResponse.getParentName())
                            .parentEmail(audienceResponse.getParentEmail())
                            .parentMobile(audienceResponse.getParentMobile())
                            .submittedAt(audienceResponse.getSubmittedAt())
                            // User (parent) and linked child user
                            .parentUser(userDTO)
                            .childUser(childUserDTO)
                            .customFields(customFields)
                            // Assigned counsellor
                            .assignedCounsellorId(assignedCounsellorId)
                            .build();
                })
                .collect(Collectors.toList());

        return new PageImpl<>(dtos, pageable, enquiries.getTotalElements());
    }

    /**
     * Build DTO when audience response is not found
     */
    private EnquiryWithResponseDTO buildEnquiryOnlyDTO(Enquiry enquiry) {
        return EnquiryWithResponseDTO.builder()
                .enquiryId(enquiry.getId())
                .checklist(enquiry.getChecklist())
                .enquiryStatus(enquiry.getEnquiryStatus())
                .convertionStatus(enquiry.getConvertionStatus())
                .referenceSource(enquiry.getReferenceSource())
                .assignedUserId(enquiry.getAssignedUserId())
                .assignedVisitSessionId(enquiry.getAssignedVisitSessionId())
                .feeRangeExpectation(enquiry.getFeeRangeExpectation())
                .transportRequirement(enquiry.getTransportRequirement())
                .mode(enquiry.getMode())
                .enquiryTrackingId(enquiry.getEnquiryTrackingId())
                .interestScore(enquiry.getInterestScore())
                .notes(enquiry.getNotes())
                .enquiryCreatedAt(enquiry.getCreatedAt())
                .customFields(new HashMap<>())
                .build();
    }

    /**
     * Update an existing lead with enquiry information
     * Supports partial updates - only provided fields will be updated
     * 
     * @param audienceResponseId ID of the audience response to update
     * @param requestDTO         Update request with optional fields
     * @return Response with update results
     */
    @Transactional
    public UpdateLeadWithEnquiryResponseDTO updateLeadWithEnquiry(
            String audienceResponseId,
            UpdateLeadWithEnquiryRequestDTO requestDTO) {

        logger.info("Updating lead with enquiry for audience response: {}", audienceResponseId);

        // STEP 1: Fetch and validate audience response
        AudienceResponse response = audienceResponseRepository.findById(audienceResponseId)
                .orElseThrow(() -> new VacademyException("Audience response not found"));

        // STEP 2: Get institute ID for validation
        Audience audience = audienceRepository.findById(response.getAudienceId())
                .orElseThrow(() -> new VacademyException("Audience not found"));
        String instituteId = audience.getInstituteId();

        // Track updated components
        Map<String, Object> updatedFields = new HashMap<>();
        List<String> audienceResponseUpdates = new ArrayList<>();
        List<String> enquiryUpdates = new ArrayList<>();
        List<String> parentUserUpdates = new ArrayList<>();
        List<String> childUserUpdates = new ArrayList<>();
        List<String> customFieldUpdates = new ArrayList<>();

        // STEP 3: Update Audience Response fields
        boolean audienceResponseModified = false;
        if (requestDTO.getDestinationPackageSessionId() != null) {
            response.setDestinationPackageSessionId(requestDTO.getDestinationPackageSessionId());
            audienceResponseUpdates.add("destination_package_session_id");
            audienceResponseModified = true;
        }
        if (requestDTO.getParentName() != null) {
            response.setParentName(requestDTO.getParentName());
            audienceResponseUpdates.add("parent_name");
            audienceResponseModified = true;
        }
        if (requestDTO.getParentEmail() != null) {
            response.setParentEmail(requestDTO.getParentEmail());
            audienceResponseUpdates.add("parent_email");
            audienceResponseModified = true;
        }
        if (requestDTO.getParentMobile() != null) {
            response.setParentMobile(requestDTO.getParentMobile());
            audienceResponseUpdates.add("parent_mobile");
            audienceResponseModified = true;
        }

        if (audienceResponseModified) {
            audienceResponseRepository.save(response);
            logger.info("Updated audience response fields: {}", audienceResponseUpdates);
        }

        // STEP 4: Update Enquiry (if provided and exists)
        UUID enquiryId = null;
        if (requestDTO.getEnquiry() != null && StringUtils.hasText(response.getEnquiryId())) {
            try {
                enquiryId = UUID.fromString(response.getEnquiryId());
                Optional<Enquiry> enquiryOpt = enquiryRepository.findById(enquiryId);

                if (enquiryOpt.isPresent()) {
                    Enquiry enquiry = enquiryOpt.get();
                    EnquiryDTO enquiryDTO = requestDTO.getEnquiry();

                    // Update only non-null fields
                    if (enquiryDTO.getChecklist() != null) {
                        enquiry.setChecklist(enquiryDTO.getChecklist());
                        enquiryUpdates.add("checklist");
                    }
                    if (enquiryDTO.getEnquiryStatus() != null) {
                        enquiry.setEnquiryStatus(enquiryDTO.getEnquiryStatus());
                        enquiryUpdates.add("enquiry_status");
                    }
                    if (enquiryDTO.getConvertionStatus() != null) {
                        enquiry.setConvertionStatus(enquiryDTO.getConvertionStatus());
                        enquiryUpdates.add("convertion_status");
                    }
                    if (enquiryDTO.getReferenceSource() != null) {
                        enquiry.setReferenceSource(enquiryDTO.getReferenceSource());
                        enquiryUpdates.add("reference_source");
                    }
                    if (enquiryDTO.getFeeRangeExpectation() != null) {
                        enquiry.setFeeRangeExpectation(enquiryDTO.getFeeRangeExpectation());
                        enquiryUpdates.add("fee_range_expectation");
                    }
                    if (enquiryDTO.getTransportRequirement() != null) {
                        enquiry.setTransportRequirement(enquiryDTO.getTransportRequirement());
                        enquiryUpdates.add("transport_requirement");
                    }
                    if (enquiryDTO.getMode() != null) {
                        enquiry.setMode(enquiryDTO.getMode());
                        enquiryUpdates.add("mode");
                    }
                    if (enquiryDTO.getEnquiryTrackingId() != null) {
                        enquiry.setEnquiryTrackingId(enquiryDTO.getEnquiryTrackingId());
                        enquiryUpdates.add("enquiry_tracking_id");
                    }
                    if (enquiryDTO.getInterestScore() != null) {
                        enquiry.setInterestScore(enquiryDTO.getInterestScore());
                        enquiryUpdates.add("interest_score");
                    }
                    if (enquiryDTO.getNotes() != null) {
                        enquiry.setNotes(enquiryDTO.getNotes());
                        enquiryUpdates.add("notes");
                    }

                    if (!enquiryUpdates.isEmpty()) {
                        enquiryRepository.save(enquiry);
                        logger.info("Updated enquiry fields: {}", enquiryUpdates);
                    }
                } else {
                    logger.warn("Enquiry not found for ID: {}, skipping enquiry update", enquiryId);
                }
            } catch (IllegalArgumentException e) {
                logger.warn("Invalid enquiry ID format: {}, skipping enquiry update", response.getEnquiryId());
            }
        }

        // STEP 5: Update Parent and Child Users
        String parentUserId = response.getUserId();
        String childUserId = null;

        if (requestDTO.getParentUserDTO() != null || requestDTO.getChildUserDTO() != null) {
            // Fetch parent and child users in one call
            List<vacademy.io.common.auth.dto.ParentWithChildDTO> parentWithChildren = authService
                    .getUsersWithChildren(List.of(parentUserId));

            if (!parentWithChildren.isEmpty()) {
                vacademy.io.common.auth.dto.ParentWithChildDTO parentWithChild = parentWithChildren.get(0);
                UserDTO existingParent = parentWithChild.getParent();
                UserDTO existingChild = parentWithChild.getChild();

                // Update Parent User
                if (requestDTO.getParentUserDTO() != null) {
                    UserDTO mergedParent = mergeUserDTO(existingParent, requestDTO.getParentUserDTO());
                    authService.updateUser(mergedParent, parentUserId);

                    // Track which fields were updated
                    if (requestDTO.getParentUserDTO().getFullName() != null)
                        parentUserUpdates.add("full_name");
                    if (requestDTO.getParentUserDTO().getEmail() != null)
                        parentUserUpdates.add("email");
                    if (requestDTO.getParentUserDTO().getMobileNumber() != null)
                        parentUserUpdates.add("mobile_number");
                    if (requestDTO.getParentUserDTO().getAddressLine() != null)
                        parentUserUpdates.add("address_line");
                    if (requestDTO.getParentUserDTO().getCity() != null)
                        parentUserUpdates.add("city");
                    if (requestDTO.getParentUserDTO().getPinCode() != null)
                        parentUserUpdates.add("pin_code");
                    if (requestDTO.getParentUserDTO().getDateOfBirth() != null)
                        parentUserUpdates.add("date_of_birth");
                    if (requestDTO.getParentUserDTO().getGender() != null)
                        parentUserUpdates.add("gender");

                    logger.info("Updated parent user fields: {}", parentUserUpdates);
                }

                // Update Child User (if exists)
                if (requestDTO.getChildUserDTO() != null && existingChild != null) {
                    UserDTO mergedChild = mergeUserDTO(existingChild, requestDTO.getChildUserDTO());
                    authService.updateUser(mergedChild, existingChild.getId());
                    childUserId = existingChild.getId();

                    // Track which fields were updated
                    if (requestDTO.getChildUserDTO().getFullName() != null)
                        childUserUpdates.add("full_name");
                    if (requestDTO.getChildUserDTO().getEmail() != null)
                        childUserUpdates.add("email");
                    if (requestDTO.getChildUserDTO().getDateOfBirth() != null)
                        childUserUpdates.add("date_of_birth");
                    if (requestDTO.getChildUserDTO().getGender() != null)
                        childUserUpdates.add("gender");

                    logger.info("Updated child user fields: {}", childUserUpdates);
                } else if (requestDTO.getChildUserDTO() != null) {
                    logger.warn("Child user not found for parent {}, skipping child update", parentUserId);
                }
            }
        }

        // STEP 6: Update Custom Field Values (Upsert strategy)
        if (requestDTO.getCustomFieldValues() != null && !requestDTO.getCustomFieldValues().isEmpty()) {
            // Fetch existing custom field values
            List<CustomFieldValues> existingValues = customFieldValuesRepository
                    .findBySourceTypeAndSourceId("AUDIENCE_RESPONSE", audienceResponseId);

            Map<String, CustomFieldValues> existingMap = existingValues.stream()
                    .collect(Collectors.toMap(
                            cfv -> {
                                // Get field key from custom field
                                CustomFields cf = customFieldRepository.findById(cfv.getCustomFieldId()).orElse(null);
                                return cf != null ? cf.getFieldKey() : "";
                            },
                            cfv -> cfv,
                            (a, b) -> a));

            // Upsert custom field values
            for (Map.Entry<String, String> entry : requestDTO.getCustomFieldValues().entrySet()) {
                String fieldKey = entry.getKey();
                String fieldValue = entry.getValue();

                if (existingMap.containsKey(fieldKey)) {
                    // Update existing value
                    CustomFieldValues existing = existingMap.get(fieldKey);
                    existing.setValue(fieldValue);
                    customFieldValuesRepository.save(existing);
                    customFieldUpdates.add(fieldKey + " (updated)");
                } else {
                    // Create new custom field value
                    // Find custom field by key and institute (to avoid duplicate field_key across
                    // institutes)
                    Optional<CustomFields> customFieldOpt = customFieldRepository
                            .findByFieldKeyAndInstituteId(fieldKey, instituteId);

                    if (customFieldOpt.isPresent()) {
                        CustomFieldValues newValue = CustomFieldValues.builder()
                                .sourceType("AUDIENCE_RESPONSE")
                                .sourceId(audienceResponseId)
                                .customFieldId(customFieldOpt.get().getId())
                                .value(fieldValue)
                                .build();
                        customFieldValuesRepository.save(newValue);
                        customFieldUpdates.add(fieldKey + " (added)");
                    } else {
                        logger.warn("Custom field not found for key: {}, skipping", fieldKey);
                    }
                }
            }

            if (!customFieldUpdates.isEmpty()) {
                logger.info("Updated custom field values: {}", customFieldUpdates);
            }
        }

        // STEP 7: Update Counselor Assignment
        String updatedCounsellorId = null;
        if (requestDTO.getCounsellorId() != null && !requestDTO.getCounsellorId().isEmpty()
                && StringUtils.hasText(response.getEnquiryId())) {

            try {
                UUID enquiryIdForCounselor = UUID.fromString(response.getEnquiryId());
                Optional<Enquiry> enquiryOpt = enquiryRepository.findById(enquiryIdForCounselor);

                if (enquiryOpt.isPresent()) {
                    Enquiry enquiry = enquiryOpt.get();

                    // Validate counselor
                    if (validateCounselor(requestDTO.getCounsellorId(), instituteId)) {
                        // Delete old counselor link
                        linkedUsersRepository.deleteBySourceAndSourceId("ENQUIRY", response.getEnquiryId());

                        // Create new counselor link
                        LinkedUsers newLink = LinkedUsers.builder()
                                .source("ENQUIRY")
                                .sourceId(response.getEnquiryId())
                                .userId(requestDTO.getCounsellorId())
                                .build();
                        linkedUsersRepository.save(newLink);

                        // Update enquiry flag
                        enquiry.setAssignedUserId(true);
                        enquiryRepository.save(enquiry);

                        updatedCounsellorId = requestDTO.getCounsellorId();
                        logger.info("Updated counselor assignment to: {}", updatedCounsellorId);
                    } else {
                        logger.warn("Counselor validation failed for ID: {}, skipping counselor update",
                                requestDTO.getCounsellorId());
                    }
                }
            } catch (IllegalArgumentException e) {
                logger.warn("Invalid enquiry ID format for counselor update: {}", response.getEnquiryId());
            }
        }

        // STEP 8: Build updated fields map
        updatedFields.put("audience_response", audienceResponseUpdates);
        updatedFields.put("enquiry", enquiryUpdates);
        updatedFields.put("parent_user", parentUserUpdates);
        updatedFields.put("child_user", childUserUpdates);
        updatedFields.put("custom_fields", customFieldUpdates);
        updatedFields.put("counselor", updatedCounsellorId != null);

        // STEP 9: Build and return response
        return UpdateLeadWithEnquiryResponseDTO.builder()
                .audienceResponseId(audienceResponseId)
                .enquiryId(enquiryId)
                .parentUserId(parentUserId)
                .childUserId(childUserId)
                .counsellorId(updatedCounsellorId)
                .message("Lead and enquiry updated successfully")
                .updatedFields(updatedFields)
                .build();
    }

    /**
     * Merge user DTO for partial updates
     * Takes existing user data and overlays update data (only non-null fields)
     * 
     * @param existing Existing user data from database
     * @param updates  Update data from request
     * @return Merged user DTO with updates applied
     */
    private UserDTO mergeUserDTO(UserDTO existing, UserDTO updates) {
        return UserDTO.builder()
                .id(existing.getId())
                .username(existing.getUsername())
                .email(updates.getEmail() != null ? updates.getEmail() : existing.getEmail())
                .fullName(updates.getFullName() != null ? updates.getFullName() : existing.getFullName())
                .addressLine(updates.getAddressLine() != null ? updates.getAddressLine() : existing.getAddressLine())
                .city(updates.getCity() != null ? updates.getCity() : existing.getCity())
                .region(updates.getRegion() != null ? updates.getRegion() : existing.getRegion())
                .pinCode(updates.getPinCode() != null ? updates.getPinCode() : existing.getPinCode())
                .mobileNumber(
                        updates.getMobileNumber() != null ? updates.getMobileNumber() : existing.getMobileNumber())
                .dateOfBirth(updates.getDateOfBirth() != null ? updates.getDateOfBirth() : existing.getDateOfBirth())
                .gender(updates.getGender() != null ? updates.getGender() : existing.getGender())
                .isRootUser(existing.isRootUser())
                .profilePicFileId(updates.getProfilePicFileId() != null ? updates.getProfilePicFileId()
                        : existing.getProfilePicFileId())
                .roles(existing.getRoles())
                .lastLoginTime(existing.getLastLoginTime())
                .isParent(existing.getIsParent())
                .linkedParentId(existing.getLinkedParentId())
                .build();
    }

    /**
     * Calculate workflowActivateDayAt based on audience
     * workflow_setting.offset_day.
     * If offset_day is present, adds/subtracts that many days from current date.
     * If not present, returns current timestamp.
     *
     * @param audience The audience entity containing settingJson
     * @return Timestamp for workflowActivateDayAt
     */
    private Timestamp calculateWorkflowActivateDayAt(Audience audience) {
        try {
            String settingJson = audience.getSettingJson();
            if (!StringUtils.hasText(settingJson)) {
                logger.debug("No settingJson for audience {}, using current timestamp", audience.getId());
                return Timestamp.valueOf(LocalDateTime.now());
            }

            ObjectMapper mapper = new ObjectMapper();
            JsonNode rootNode = mapper.readTree(settingJson);
            JsonNode workflowSetting = rootNode.path("workflow_setting");

            if (workflowSetting.isMissingNode()) {
                logger.debug("No workflow_setting for audience {}, using current timestamp", audience.getId());
                return Timestamp.valueOf(LocalDateTime.now());
            }

            JsonNode offsetDayNode = workflowSetting.path("offset_day");
            if (offsetDayNode.isMissingNode() || !offsetDayNode.isNumber()) {
                logger.debug("No valid offset_day for audience {}, using current timestamp", audience.getId());
                return Timestamp.valueOf(LocalDateTime.now());
            }

            int offsetDays = offsetDayNode.asInt();
            LocalDateTime activateDateTime = LocalDateTime.now().plusDays(offsetDays);

            logger.info("Calculated workflowActivateDayAt for audience {}: offset_day={}, result={}",
                    audience.getId(), offsetDays, activateDateTime);

            return Timestamp.valueOf(activateDateTime);
        } catch (Exception e) {
            logger.warn("Error parsing settingJson for audience {}, using current timestamp: {}",
                    audience.getId(), e.getMessage());
            return Timestamp.valueOf(LocalDateTime.now());
        }
    }

    private void sendEnquiryConfirmationEmail(UserDTO parentUser, UserDTO childUser, Audience audience, Enquiry enquiry,
            PackageSession packageSession) {

        String instituteId = audience.getInstituteId();

        // Get credentials (username and password)
        // Get credentials (username and password)
        String username = parentUser != null ? parentUser.getEmail() : "";
        String password = "";

        if (parentUser != null) {
            try {
                UserDTO userWithPassword = authService.getUsersFromAuthServiceWithPasswordByUserId(parentUser.getId());
                if (userWithPassword != null && StringUtils.hasText(userWithPassword.getPassword())) {
                    password = userWithPassword.getPassword();
                } else {
                    password = parentUser.getPassword(); // Fallback
                }
            } catch (Exception e) {
                logger.error("Failed to fetch user password for email", e);
                password = parentUser.getPassword(); // Fallback
            }
        }

        // Build portal URL (hardcoded for now)
        String portalUrl = "https://learner-portal.vacademy.io";

        // Format submission time
        java.time.ZonedDateTime now = java.time.ZonedDateTime.now();
        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter
                .ofPattern("MMM dd, yyyy hh:mm a z");
        String submissionTime = now.format(formatter);

        String sessionName = (packageSession != null && packageSession.getSession() != null)
                ? packageSession.getSession().getSessionName()
                : "Session";
        String trackingId = enquiry != null ? enquiry.getEnquiryTrackingId() : "N/A";
        String campaignName = audience.getCampaignName();
        String studentName = childUser != null ? childUser.getFullName() : "Student";
        String parentName = parentUser != null ? parentUser.getFullName() : "Parent";

        // Try to fetch template from notification_event_config
        Optional<NotificationEventConfig> configOpt = notificationEventConfigRepository
                .findFirstByEventNameAndSourceTypeAndSourceIdAndTemplateTypeAndIsActiveTrueOrderByUpdatedAtDesc(
                        NotificationEventType.ENQUIRY_FORM_SUBMISSION,
                        NotificationSourceType.AUDIENCE,
                        audience.getInstituteId(), // Use audience ID as source ID? No, usually Institute or Audience
                                                   // ID. Let's use Audience ID as per plan.
                        NotificationTemplateType.EMAIL);

        // Just in case, try searching with source_id = audience_id if institute_id one
        // failed or vice versa depending on config strategy
        if (configOpt.isEmpty()) {
            configOpt = notificationEventConfigRepository
                    .findFirstByEventNameAndSourceTypeAndSourceIdAndTemplateTypeAndIsActiveTrueOrderByUpdatedAtDesc(
                            NotificationEventType.ENQUIRY_FORM_SUBMISSION,
                            NotificationSourceType.AUDIENCE,
                            audience.getId(),
                            NotificationTemplateType.EMAIL);
        }

        if (configOpt.isPresent()) {
            logger.info("Found custom email template for enquiry submission: {}", configOpt.get().getTemplateId());

            // Build variables for template
            NotificationTemplateVariables variables = NotificationTemplateVariables.builder()
                    .userName(username)
                    .userPassword(password)
                    .portalUrl(portalUrl)
                    .childName(studentName)
                    .trackingId(trackingId)
                    .sessionName(sessionName)
                    .submissionTime(submissionTime)
                    .instituteId(instituteId)
                    .campaignName(campaignName)
                    .build();

            sendUniqueLinkService.sendUniqueLinkByEmailByEnrollInvite(
                    instituteId,
                    parentUser,
                    configOpt.get().getTemplateId(),
                    null,
                    variables);
        } else {
            // Default Email Fallback
            logger.info("No custom template found, using default enquiry confirmation email");

            String defaultEmailBody = buildDefaultEnquiryEmailBody(
                    parentName,
                    studentName,
                    sessionName,
                    trackingId,
                    submissionTime,
                    username,
                    password,
                    portalUrl,
                    campaignName);

            GenericEmailRequest emailRequest = new GenericEmailRequest();
            emailRequest.setTo(parentUser.getEmail());
            emailRequest.setSubject("Enquiry Submitted Successfully - " + campaignName + " - " + trackingId);
            emailRequest.setBody(defaultEmailBody);

            notificationService.sendGenericHtmlMail(emailRequest, instituteId);
        }
    }

    private String buildDefaultEnquiryEmailBody(String parentName, String studentName, String sessionName,
            String trackingId, String submissionTime, String username, String password, String portalUrl,
            String campaignName) {

        StringBuilder credentialSection = new StringBuilder();
        if (StringUtils.hasText(password)) {
            credentialSection.append(
                    "<div style='background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;'>")
                    .append("<h3 style='margin-top: 0; color: #2c3e50;'>Portal Login Credentials</h3>")
                    .append("<p style='margin: 5px 0;'><strong>Username:</strong> ").append(username).append("</p>")
                    .append("<p style='margin: 5px 0;'><strong>Password:</strong> ").append(password).append("</p>")
                    .append("</div>");
        }

        return "<html>" +
                "<body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>" +
                "<div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;'>"
                +
                "<h2 style='color: #2c3e50; text-align: center;'>Enquiry Received Successfully</h2>" +
                "<p>Dear " + parentName + ",</p>" +
                "<p>Thank you for your interest in <strong>" + campaignName + "</strong> (" + sessionName
                + ") for <strong>" + studentName + "</strong>.</p>" +
                "<p>We have received your enquiry details. Your tracking ID is:</p>" +
                "<h3 style='text-align: center; background-color: #e8f4f8; padding: 10px; border-radius: 5px;'>"
                + trackingId + "</h3>" +
                "<p>We have created an account for you on our learner portal where you can track the status of your enquiry.</p>"
                +
                credentialSection.toString() +
                "<div style='text-align: center; margin-top: 25px;'>" +
                "<a href='" + portalUrl
                + "' style='background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;'>Login to Portal</a>"
                +
                "</div>" +
                "<p style='margin-top: 30px; font-size: 12px; color: #777; text-align: center;'>Submitted on: "
                + submissionTime + "</p>" +
                "</div>" +
                "</body>" +
                "</html>";
    }

    /**
     * Generate a 5-character alphanumeric tracking ID
     */
    private String generateCustomTrackingId() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder sb = new StringBuilder();
        Random random = new Random();
        for (int i = 0; i < 5; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }
}
