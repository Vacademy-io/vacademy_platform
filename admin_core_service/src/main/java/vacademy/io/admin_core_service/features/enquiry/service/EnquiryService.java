package vacademy.io.admin_core_service.features.enquiry.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.applicant.entity.Applicant;
import vacademy.io.admin_core_service.features.applicant.entity.ApplicationStage;
import vacademy.io.admin_core_service.features.applicant.repository.ApplicantRepository;
import vacademy.io.admin_core_service.features.applicant.repository.ApplicationStageRepository;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldRepository;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.enquiry.dto.AdminEnquiryDetailResponseDTO;
import vacademy.io.admin_core_service.features.enquiry.dto.BulkEnquiryStatusUpdateRequestDTO;
import vacademy.io.admin_core_service.features.enquiry.dto.BulkEnquiryStatusUpdateResponseDTO;
import vacademy.io.admin_core_service.features.enquiry.dto.LinkCounselorDTO;
import vacademy.io.admin_core_service.features.enquiry.entity.Enquiry;
import vacademy.io.admin_core_service.features.enquiry.entity.LinkedUsers;
import vacademy.io.admin_core_service.features.enquiry.repository.EnquiryRepository;
import vacademy.io.admin_core_service.features.enquiry.repository.LinkedUsersRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.common.auth.dto.ParentWithChildDTO;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class EnquiryService {

    private static final Logger logger = LoggerFactory.getLogger(EnquiryService.class);

    @Autowired
    private LinkedUsersRepository linkedUsersRepository;

    @Autowired
    private EnquiryRepository enquiryRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private AudienceResponseRepository audienceResponseRepository;

    @Autowired
    private AudienceRepository audienceRepository;

    @Autowired
    private ApplicantRepository applicantRepository;

    @Autowired
    private ApplicationStageRepository applicationStageRepository;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private CustomFieldValuesRepository customFieldValuesRepository;

    @Autowired
    private CustomFieldRepository customFieldRepository;

    public AdminEnquiryDetailResponseDTO getAdminEnquiryDetails(String enquiryId) {
        // Step 1: Fetch the Enquiry itself
        Enquiry enquiry = enquiryRepository.findById(UUID.fromString(enquiryId))
                .orElseThrow(() -> new VacademyException("Enquiry not found with ID: " + enquiryId));

        // Step 2: Fetch the linked AudienceResponse
        AudienceResponse ar = audienceResponseRepository.findByEnquiryId(enquiryId)
                .orElse(null);

        // Step 3: Build Parent + Child details
        AdminEnquiryDetailResponseDTO.ParentDetails parentDetails = null;
        AdminEnquiryDetailResponseDTO.ChildDetails childDetails = null;

        if (ar != null && ar.getUserId() != null) {
            try {
                List<ParentWithChildDTO> usersWithChildren = authService.getUsersWithChildren(List.of(ar.getUserId()));
                if (!usersWithChildren.isEmpty()) {
                    ParentWithChildDTO parentWithChild = usersWithChildren.get(0);
                    UserDTO parentUser = parentWithChild.getParent();
                    UserDTO childUser = parentWithChild.getChild();

                    if (parentUser != null) {
                        parentDetails = AdminEnquiryDetailResponseDTO.ParentDetails.builder()
                                .id(parentUser.getId())
                                .name(parentUser.getFullName())
                                .email(parentUser.getEmail())
                                .phone(parentUser.getMobileNumber())
                                .addressLine(parentUser.getAddressLine())
                                .city(parentUser.getCity())
                                .pinCode(parentUser.getPinCode())
                                .build();
                    }

                    if (childUser != null) {
                        childDetails = AdminEnquiryDetailResponseDTO.ChildDetails.builder()
                                .id(childUser.getId())
                                .name(childUser.getFullName())
                                .dob(childUser.getDateOfBirth())
                                .gender(childUser.getGender())
                                .build();
                    }
                }
            } catch (Exception e) {
                logger.warn("Failed to fetch users from auth-service for enquiry {}: {}", enquiryId, e.getMessage());
                // Fall back to snapshot data below
            }
        }

        // Fallback: use AudienceResponse snapshot if auth-service failed or data is
        // missing
        if (ar != null && parentDetails == null) {
            parentDetails = AdminEnquiryDetailResponseDTO.ParentDetails.builder()
                    .name(ar.getParentName())
                    .email(ar.getParentEmail())
                    .phone(ar.getParentMobile())
                    .build();
        }

        // Step 4: Application progress
        String applicantId = ar != null ? ar.getApplicantId() : null;
        String overallStatus = ar != null ? ar.getOverallStatus() : null;
        String currentStageName = null;
        String currentStageType = null;
        String currentStageStatus = null;

        if (applicantId != null) {
            try {
                Optional<Applicant> applicantOpt = applicantRepository.findById(UUID.fromString(applicantId));
                if (applicantOpt.isPresent()) {
                    Applicant applicant = applicantOpt.get();
                    overallStatus = applicant.getOverallStatus();
                    currentStageStatus = applicant.getApplicationStageStatus();

                    if (applicant.getApplicationStageId() != null) {
                        Optional<ApplicationStage> stageOpt = applicationStageRepository
                                .findById(UUID.fromString(applicant.getApplicationStageId()));
                        if (stageOpt.isPresent()) {
                            currentStageName = stageOpt.get().getStageName();
                            currentStageType = stageOpt.get().getType() != null
                                    ? stageOpt.get().getType().name()
                                    : null;
                        }
                    }
                }
            } catch (Exception e) {
                logger.warn("Failed to fetch applicant details for enquiry {}: {}", enquiryId, e.getMessage());
            }
        }

        // Step 5: Campaign / PackageSession details
        AdminEnquiryDetailResponseDTO.CampaignDetails campaignDetails = null;
        if (ar != null) {
            String campaignName = null;
            if (ar.getAudienceId() != null) {
                try {
                    campaignName = audienceRepository.findById(ar.getAudienceId())
                            .map(a -> a.getCampaignName()).orElse(null);
                } catch (Exception e) {
                    logger.warn("Failed to fetch audience details: {}", e.getMessage());
                }
            }

            String packageSessionName = null;
            String levelName = null;
            String groupName = null;
            if (ar.getDestinationPackageSessionId() != null) {
                try {
                    Optional<PackageSession> psOpt = packageSessionRepository
                            .findById(ar.getDestinationPackageSessionId());
                    if (psOpt.isPresent()) {
                        PackageSession ps = psOpt.get();
                        packageSessionName = ps.getSession() != null ? ps.getSession().getSessionName() : null;
                        levelName = ps.getLevel() != null ? ps.getLevel().getLevelName() : null;
                        groupName = ps.getGroup() != null ? ps.getGroup().getGroupName() : null;
                    }
                } catch (Exception e) {
                    logger.warn("Failed to fetch package session details: {}", e.getMessage());
                }
            }

            campaignDetails = AdminEnquiryDetailResponseDTO.CampaignDetails.builder()
                    .audienceId(ar.getAudienceId())
                    .campaignName(campaignName)
                    .sourceType(ar.getSourceType())
                    .sourceId(ar.getSourceId())
                    .destinationPackageSessionId(ar.getDestinationPackageSessionId())
                    .packageSessionName(packageSessionName)
                    .levelName(levelName)
                    .groupName(groupName)
                    .build();
        }

        // Step 6: Assigned Counselor
        AdminEnquiryDetailResponseDTO.CounselorDetails counselorDetails = null;
        Optional<LinkedUsers> linkedUserOpt = linkedUsersRepository.findBySourceAndSourceId("ENQUIRY", enquiryId);
        if (linkedUserOpt.isPresent()) {
            String counselorId = linkedUserOpt.get().getUserId();
            String counselorName = null;
            String counselorEmail = null;
            try {
                List<UserDTO> counselorUsers = authService.getUsersFromAuthServiceByUserIds(List.of(counselorId));
                if (!CollectionUtils.isEmpty(counselorUsers)) {
                    UserDTO counselor = counselorUsers.get(0);
                    counselorName = counselor.getFullName();
                    counselorEmail = counselor.getEmail();
                }
            } catch (Exception e) {
                logger.warn("Failed to fetch counselor details for enquiry {}: {}", enquiryId, e.getMessage());
            }
            counselorDetails = AdminEnquiryDetailResponseDTO.CounselorDetails.builder()
                    .counselorId(counselorId)
                    .counselorName(counselorName)
                    .counselorEmail(counselorEmail)
                    .build();
        }

        // Step 7: Custom Field Values (form answers submitted by the respondent)
        Map<String, String> customFields = Collections.emptyMap();
        if (ar != null) {
            customFields = buildCustomFieldMap(ar.getId());
        }

        // Step 8: Assemble and return
        return AdminEnquiryDetailResponseDTO.builder()
                // Enquiry core
                .enquiryId(enquiry.getId().toString())
                .trackingId(enquiry.getEnquiryTrackingId())
                .enquiryStatus(enquiry.getEnquiryStatus())
                .conversionStatus(enquiry.getConvertionStatus())
                .referenceSource(enquiry.getReferenceSource())
                .feeRangeExpectation(enquiry.getFeeRangeExpectation())
                .transportRequirement(enquiry.getTransportRequirement())
                .mode(enquiry.getMode())
                .interestScore(enquiry.getInterestScore())
                .notes(enquiry.getNotes())
                .checklist(enquiry.getChecklist())
                .enquiryCreatedAt(enquiry.getCreatedAt())
                .enquiryUpdatedAt(enquiry.getUpdatedAt())
                // People
                .parent(parentDetails)
                .child(childDetails)
                // Application progress
                .alreadyApplied(applicantId != null)
                .applicantId(applicantId)
                .overallStatus(overallStatus)
                .currentStageName(currentStageName)
                .currentStageType(currentStageType)
                .currentStageStatus(currentStageStatus)
                // Campaign
                .campaign(campaignDetails)
                // Counselor
                .assignedCounselor(counselorDetails)
                // Custom fields
                .customFields(customFields)
                .build();
    }

    /**
     * Helper: Build fieldName -> value map from audience response custom field
     * values.
     */
    private Map<String, String> buildCustomFieldMap(String audienceResponseId) {
        List<CustomFieldValues> savedValues = customFieldValuesRepository
                .findBySourceTypeAndSourceId("AUDIENCE_RESPONSE", audienceResponseId);

        if (CollectionUtils.isEmpty(savedValues)) {
            return Collections.emptyMap();
        }

        Set<String> customFieldIds = savedValues.stream()
                .map(CustomFieldValues::getCustomFieldId)
                .collect(Collectors.toSet());

        List<CustomFields> fieldDefinitions = customFieldRepository.findAllById(customFieldIds);
        Map<String, String> fieldIdToName = fieldDefinitions.stream()
                .collect(Collectors.toMap(CustomFields::getId, CustomFields::getFieldName, (a, b) -> a));

        Map<String, String> result = new HashMap<>();
        for (CustomFieldValues cfv : savedValues) {
            String fieldName = fieldIdToName.get(cfv.getCustomFieldId());
            if (StringUtils.hasText(fieldName) && StringUtils.hasText(cfv.getValue())) {
                result.put(fieldName, cfv.getValue());
            }
        }
        return result;
    }

    // ─────────────────────────────────────────────────────────
    // API 2: Bulk Update Enquiry Status
    // ─────────────────────────────────────────────────────────

    /**
     * Bulk update enquiry_status and/or conversion_status for multiple enquiries.
     * Null fields in the request are ignored (partial update semantics).
     */
    @Transactional
    public BulkEnquiryStatusUpdateResponseDTO bulkUpdateEnquiryStatus(BulkEnquiryStatusUpdateRequestDTO request) {
        // Validate input
        if (CollectionUtils.isEmpty(request.getEnquiryIds())) {
            throw new VacademyException("enquiry_ids must not be empty");
        }
        if (!StringUtils.hasText(request.getEnquiryStatus()) && !StringUtils.hasText(request.getConversionStatus())) {
            throw new VacademyException("At least one of enquiry_status or conversion_status must be provided");
        }

        // Parse to UUIDs, silently skipping malformed IDs
        List<UUID> uuids = request.getEnquiryIds().stream()
                .filter(StringUtils::hasText)
                .map(id -> {
                    try {
                        return UUID.fromString(id);
                    } catch (IllegalArgumentException e) {
                        logger.warn("Skipping invalid enquiry UUID: {}", id);
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        if (uuids.isEmpty()) {
            throw new VacademyException("No valid enquiry IDs provided");
        }

        // Fetch all matching enquiries in one query
        List<Enquiry> enquiries = enquiryRepository.findAllById(uuids);

        // Apply updates (only non-null fields)
        for (Enquiry enquiry : enquiries) {
            if (StringUtils.hasText(request.getEnquiryStatus())) {
                enquiry.setEnquiryStatus(request.getEnquiryStatus());
            }
            if (StringUtils.hasText(request.getConversionStatus())) {
                enquiry.setConvertionStatus(request.getConversionStatus());
            }
        }

        List<Enquiry> saved = enquiryRepository.saveAll(enquiries);
        int updatedCount = saved.size();
        logger.info("Bulk updated {} enquiries. Status: {}, ConversionStatus: {}",
                updatedCount, request.getEnquiryStatus(), request.getConversionStatus());

        return BulkEnquiryStatusUpdateResponseDTO.builder()
                .updatedCount(updatedCount)
                .message(updatedCount + " enquiry status(es) updated successfully")
                .build();
    }

    // ─────────────────────────────────────────────────────────
    // Existing: Link Counselor to Enquiry
    // ─────────────────────────────────────────────────────────

    @Transactional
    public String linkCounselorToSource(LinkCounselorDTO request) {
        // 1. Validate Input
        if (!StringUtils.hasText(request.getCounselorId()) ||
                !StringUtils.hasText(request.getSourceId()) ||
                !StringUtils.hasText(request.getSourceType())) {
            throw new VacademyException("Counselor ID, Source ID and Source Type are required");
        }

        // 2. Validate Source Existence (Enquiry)
        if ("ENQUIRY".equalsIgnoreCase(request.getSourceType())) {
            enquiryRepository.findById(java.util.UUID.fromString(request.getSourceId()))
                    .orElseThrow(() -> new VacademyException("Enquiry not found with ID: " + request.getSourceId()));
        } else {
            // For now, we strictly support ENQUIRY as per discussion
            throw new VacademyException("Only ENQUIRY source type is currently supported");
        }

        // 3. Validate User Existence (not role)
        UserDTO assignedUser = null;
        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(request.getCounselorId()));
            if (users != null && !users.isEmpty()) {
                assignedUser = users.get(0);
            }
        } catch (Exception e) {
            throw new VacademyException("Failed to fetch user details: " + e.getMessage());
        }

        if (assignedUser == null) {
            throw new VacademyException("User not found with ID: " + request.getCounselorId());
        }

        // 4. Check for existing link to avoid duplicates
        if (linkedUsersRepository.existsBySourceAndSourceIdAndUserId(
                request.getSourceType(), request.getSourceId(), request.getCounselorId())) {
            return "Counselor is already linked to this enquiry";
        }

        // 5. Create and Save Link
        LinkedUsers link = LinkedUsers.builder()
                .source(request.getSourceType())
                .sourceId(request.getSourceId())
                .userId(request.getCounselorId())
                .build();

        linkedUsersRepository.save(link);

        // 6. Update Enquiry assigned_user_id to true
        if ("ENQUIRY".equalsIgnoreCase(request.getSourceType())) {
            vacademy.io.admin_core_service.features.enquiry.entity.Enquiry enquiry = enquiryRepository
                    .findById(java.util.UUID.fromString(request.getSourceId()))
                    .orElseThrow(() -> new VacademyException("Enquiry not found during update"));

            enquiry.setAssignedUserId(true);
            enquiryRepository.save(enquiry);
        }

        return "Counselor linked successfully";
    }
}
