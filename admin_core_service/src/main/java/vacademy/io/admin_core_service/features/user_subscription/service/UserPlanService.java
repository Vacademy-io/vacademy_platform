package vacademy.io.admin_core_service.features.user_subscription.service;

import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.repository.PackageSessionLearnerInvitationToPaymentOptionRepository;
import vacademy.io.admin_core_service.features.enroll_invite.service.PackageSessionEnrollInviteToPaymentOptionService;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption; // Added
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionSourceEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionTypeEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.dto.policy.EnrollmentPolicyJsonDTOs;
import vacademy.io.common.institute.entity.session.PackageSession;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerBatchEnrollService;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.notification.service.DynamicNotificationService;
import vacademy.io.admin_core_service.features.user_subscription.dto.*;
import vacademy.io.admin_core_service.features.user_subscription.entity.*;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanSourceEnum;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;

import java.sql.Timestamp;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.Locale;

@Service
public class UserPlanService {

    private static final Logger logger = LoggerFactory.getLogger(UserPlanService.class);

    @Autowired
    private UserPlanRepository userPlanRepository;

    @Autowired
    private PackageSessionEnrollInviteToPaymentOptionService packageSessionEnrollInviteToPaymentOptionService;

    @Autowired
    @Lazy
    public LearnerBatchEnrollService learnerBatchEnrollService;

    @Autowired
    private PaymentLogRepository paymentLogRepository;
    @Autowired
    private DynamicNotificationService dynamicNotificationService;

    @Autowired
    private AuthService authService;

    @Autowired
    private StudentSessionRepository studentSessionRepository;

    @Autowired
    private vacademy.io.admin_core_service.features.institute.repository.InstituteRepository instituteRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PackageSessionLearnerInvitationToPaymentOptionRepository packageSessionLearnerInvitationRepository;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    public UserPlan createUserPlan(String userId,
            PaymentPlan paymentPlan,
            AppliedCouponDiscount appliedCouponDiscount,
            EnrollInvite enrollInvite,
            PaymentOption paymentOption,
            PaymentInitiationRequestDTO paymentInitiationRequestDTO,
            String status) {
        return createUserPlan(userId, paymentPlan, appliedCouponDiscount, enrollInvite,
                paymentOption, paymentInitiationRequestDTO, status, null, null, null);
    }

    public UserPlan createUserPlan(String userId,
            PaymentPlan paymentPlan,
            AppliedCouponDiscount appliedCouponDiscount,
            EnrollInvite enrollInvite,
            PaymentOption paymentOption,
            PaymentInitiationRequestDTO paymentInitiationRequestDTO,
            String status,
            String source,
            String subOrgId,
            Date startDate) {
        logger.info("Creating UserPlan for userId={}, status={}, source={}, subOrgId={}",
                userId, status, source, subOrgId);

        UserPlan userPlan = new UserPlan();
        userPlan.setStatus(status);

        // ALWAYS set userId - this is preserved for both USER and SUB_ORG sources
        // For SUB_ORG: userId represents the individual learner in the sub-organization
        // For USER: userId represents the individual user themselves
        userPlan.setUserId(userId);
        logger.debug("UserPlan userId set to: {}", userId);

        // Set source and sub_org_id if provided
        if (source != null) {
            userPlan.setSource(source);
            logger.debug("UserPlan source set to: {}", source);
        } else {
            // Default to USER if not specified
            userPlan.setSource(UserPlanSourceEnum.USER.name());
            logger.debug("UserPlan source defaulted to: USER");
        }

        // For SUB_ORG source, subOrgId must be provided
        if (subOrgId != null) {
            userPlan.setSubOrgId(subOrgId);
            logger.debug("UserPlan subOrgId set to: {}", subOrgId);

            // Additional validation: if source is SUB_ORG, subOrgId should be present
            if (UserPlanSourceEnum.SUB_ORG.name().equals(userPlan.getSource())) {
                logger.info("Creating SUB_ORG UserPlan: userId={}, subOrgId={} - Both IDs preserved for data integrity",
                        userId, subOrgId);
            }
        } else if (source != null && UserPlanSourceEnum.SUB_ORG.name().equals(source)) {
            // Warning: SUB_ORG source without subOrgId
            logger.warn("Creating SUB_ORG UserPlan without subOrgId for userId={} - This may indicate a data issue",
                    userId);
        }
        setPaymentPlan(userPlan, paymentPlan);
        setAppliedCouponDiscount(userPlan, appliedCouponDiscount);
        setEnrollInvite(userPlan, enrollInvite);
        setPaymentOption(userPlan, paymentOption);

        // --- Logic to calculate and set Start and End Dates ---
        // --- Date Logic with Timestamp ---

        // Check for existing ACTIVE or PENDING plans for stacking
        Optional<UserPlan> existingPlan = userPlanRepository
                .findTopByUserIdAndEnrollInviteIdAndStatusInOrderByEndDateDesc(
                        userId,
                        enrollInvite.getId(),
                        List.of(UserPlanStatusEnum.ACTIVE.name(), UserPlanStatusEnum.PENDING.name()));

        Date effectiveStartDate;
        if (existingPlan.isPresent()) {
            // Stack the new plan after the existing one
            effectiveStartDate = existingPlan.get().getEndDate();
            if (effectiveStartDate == null) {
                effectiveStartDate = new Date(); // Fallback
            }

            // Only change status to PENDING if it was going to be ACTIVE
            // If it's PENDING_FOR_PAYMENT, let it remain so (it will be handled in
            // applyOperationsOnFirstPayment)
            if (UserPlanStatusEnum.ACTIVE.name().equals(status)) {
                status = UserPlanStatusEnum.PENDING.name();
                userPlan.setStatus(status);
            }
            logger.info("Stacking UserPlan: Found existing plan ID={}. New plan will start at {}",
                    existingPlan.get().getId(), effectiveStartDate);
        } else {
            // No existing plan, use provided startDate or now
            effectiveStartDate = startDate;
            if (effectiveStartDate != null) {
                Date currentDate = new Date();
                if (effectiveStartDate.after(currentDate)) {
                    throw new IllegalArgumentException("Start date cannot be in the future");
                }
            } else {
                effectiveStartDate = new Date();
            }
        }

        long startTimeMillis = effectiveStartDate.getTime();
        userPlan.setStartDate(new Timestamp(startTimeMillis));

        Integer validityDays = null;
        if (paymentPlan != null && paymentPlan.getValidityInDays() != null) {
            validityDays = paymentPlan.getValidityInDays();
        } else if (enrollInvite != null && enrollInvite.getLearnerAccessDays() != null) {
            validityDays = enrollInvite.getLearnerAccessDays();
        }

        if (validityDays != null) {
            // Add days to milliseconds: days * 24 * 60 * 60 * 1000
            long validityMillis = validityDays * 24L * 60L * 60L * 1000L;
            userPlan.setEndDate(new Timestamp(startTimeMillis + validityMillis));
        }
        // -----------------------------------------------------

        String paymentJson = JsonUtil.toJson(paymentInitiationRequestDTO);
        userPlan.setJsonPaymentDetails(paymentJson);

        logger.debug("Saving UserPlan with details: {}", userPlan);
        UserPlan saved = userPlanRepository.save(userPlan);
        logger.info("UserPlan created with ID={}", saved.getId());
        return saved;
    }

    private void setPaymentPlan(UserPlan userPlan, PaymentPlan plan) {
        if (plan != null) {
            userPlan.setPaymentPlan(plan);
            userPlan.setPaymentPlanId(plan.getId());
            userPlan.setPlanJson(JsonUtil.toJson(plan));
            logger.debug("Attached PaymentPlan ID={} to UserPlan", plan.getId());
        }
    }

    private void setAppliedCouponDiscount(UserPlan userPlan, AppliedCouponDiscount discount) {
        if (discount != null) {
            userPlan.setAppliedCouponDiscount(discount);
            userPlan.setAppliedCouponDiscountId(discount.getId());
            userPlan.setAppliedCouponDiscountJson(JsonUtil.toJson(discount));
            logger.debug("Attached AppliedCouponDiscount ID={} to UserPlan", discount.getId());
        }
    }

    private void setEnrollInvite(UserPlan userPlan, EnrollInvite invite) {
        if (invite != null) {
            userPlan.setEnrollInvite(invite);
            userPlan.setEnrollInviteId(invite.getId());
            logger.debug("Attached EnrollInvite ID={} to UserPlan", invite.getId());
        }
    }

    private void setPaymentOption(UserPlan userPlan, PaymentOption option) {
        if (option != null) {
            userPlan.setPaymentOption(option);
            userPlan.setPaymentOptionId(option.getId());
            userPlan.setPaymentOptionJson(JsonUtil.toJson(option));
            logger.debug("Attached PaymentOption ID={} to UserPlan", option.getId());
        }
    }

    public void applyOperationsOnFirstPayment(UserPlan userPlan) {
        logger.info("Applying operations on first payment for UserPlan ID={}", userPlan.getId());

        if (UserPlanStatusEnum.ACTIVE.name().equals(userPlan.getStatus())
                || UserPlanStatusEnum.PENDING.name().equals(userPlan.getStatus())) {
            logger.info("UserPlan already ACTIVE or pending . Skipping re-activation.");
            return;
        }

        EnrollInvite enrollInvite = userPlan.getEnrollInvite();

        // Check for OTHER existing ACTIVE or PENDING plans for stacking
        // We exclude the current plan ID just in case, though it shouldn't be
        // active/pending yet
        Optional<UserPlan> existingPlan = userPlanRepository
                .findTopByUserIdAndEnrollInviteIdAndStatusInAndIdNotInOrderByEndDateDesc(
                        userPlan.getUserId(),
                        enrollInvite.getId(),
                        List.of(
                                UserPlanStatusEnum.ACTIVE.name(),
                                UserPlanStatusEnum.PENDING.name()),
                        List.of(userPlan.getId()));

        List<String> packageSessionIds = packageSessionEnrollInviteToPaymentOptionService
                .findPackageSessionsOfEnrollInvite(enrollInvite);
        // If we found a plan, and it's NOT the current plan (sanity check)
        if (existingPlan.isPresent() && !existingPlan.get().getId().equals(userPlan.getId())) {
            // Stack it!
            userPlan.setStatus(UserPlanStatusEnum.PENDING.name());
            userPlanRepository.save(userPlan);
            logger.info("UserPlan stacked as PENDING after payment. ID={}. Existing plan ID={}", userPlan.getId(),
                    existingPlan.get().getId());
            // Do NOT shift learner to active package sessions yet
        } else {
            // Activate normally

            logger.debug("Package session IDs resolved for EnrollInvite ID={}: {}", enrollInvite.getId(),
                    packageSessionIds);
            learnerBatchEnrollService.shiftLearnerFromInvitedToActivePackageSessions(packageSessionIds,
                    userPlan.getUserId(), enrollInvite.getId());
            userPlan.setStatus(UserPlanStatusEnum.ACTIVE.name());
            userPlanRepository.save(userPlan);

            logger.info("UserPlan status updated to ACTIVE and saved. ID={}", userPlan.getId());

            // Send enrollment notifications after successful PAID enrollment

        }
        sendEnrollmentNotificationsAfterPayment(userPlan, enrollInvite, packageSessionIds);
    }

    private void sendEnrollmentNotificationsAfterPayment(UserPlan userPlan, EnrollInvite enrollInvite,
            List<String> packageSessionIds) {
        try {
            logger.info("Sending enrollment notifications for PAID enrollment. UserPlan ID: {}", userPlan.getId());

            // Get user details
            UserDTO userDTO = authService.getUsersFromAuthServiceByUserIds(List.of(userPlan.getUserId())).get(0);

            // Get institute ID from enroll invite
            String instituteId = enrollInvite.getInstituteId();

            // Get payment option
            PaymentOption paymentOption = userPlan.getPaymentOption();

            // Get first package session ID for notification
            String firstPackageSessionId = packageSessionIds.isEmpty() ? null : packageSessionIds.get(0);

            if (firstPackageSessionId == null) {
                logger.warn("No package session ID found for UserPlan ID: {}. Skipping enrollment notification.",
                        userPlan.getId());
                return;
            }

            // Send dynamic enrollment notification
            dynamicNotificationService.sendDynamicNotification(
                    NotificationEventType.LEARNER_ENROLL,
                    firstPackageSessionId,
                    instituteId,
                    userDTO,
                    paymentOption,
                    enrollInvite);
            logger.info("Enrollment notification sent successfully for user: {}", userDTO.getId());

            // Send referral invitation email
            dynamicNotificationService.sendReferralInvitationNotification(
                    instituteId,
                    userDTO,
                    enrollInvite);
            logger.info("Referral invitation sent successfully for user: {}", userDTO.getId());

        } catch (Exception e) {
            logger.error("Error sending enrollment notifications after payment for UserPlan ID: {}. " +
                    "Enrollment is complete but notification failed.", userPlan.getId(), e);
            // Don't throw exception - enrollment is complete, notification is secondary
        }
    }

    @Cacheable(value = "userPlanWithPaymentLogs", key = "#userPlanId + '_' + #includePolicyDetails")
    public UserPlanDTO getUserPlanWithPaymentLogs(String userPlanId, boolean includePolicyDetails) {
        logger.info("Getting UserPlan with payment logs for ID: {}, includePolicyDetails: {}", userPlanId,
                includePolicyDetails);

        UserPlan userPlan = userPlanRepository.findById(userPlanId)
                .orElseThrow(() -> new RuntimeException("UserPlan not found with ID: " + userPlanId));

        // Get payment logs sorted by creation date in descending order
        List<PaymentLogDTO> paymentLogs = getPaymentLogsByUserPlanId(userPlanId);

        // Convert UserPlan to DTO
        UserPlanDTO userPlanDTO = mapToDTO(userPlan);
        userPlanDTO.setPaymentLogs(paymentLogs);

        // Add policy details if requested
        if (includePolicyDetails) {
            List<PackageSessionPolicyDetailsDTO> policyDetails = buildPolicyDetailsForUserPlan(userPlan);
            userPlanDTO.setPolicyDetails(policyDetails);
        }

        logger.info("Retrieved UserPlan with {} payment logs for ID: {}", paymentLogs.size(), userPlanId);
        return userPlanDTO;
    }

    // Overloaded method for backward compatibility
    @Cacheable(value = "userPlanWithPaymentLogs", key = "#userPlanId + '_false'")
    public UserPlanDTO getUserPlanWithPaymentLogs(String userPlanId) {
        return getUserPlanWithPaymentLogs(userPlanId, false);
    }

    @Cacheable(value = "userPlanById", key = "#userPlanId")
    public UserPlan findById(String userPlanId) {
        logger.info("Finding UserPlan by ID: {}", userPlanId);
        return userPlanRepository.findById(userPlanId)
                .orElseThrow(() -> new RuntimeException("UserPlan not found with ID: " + userPlanId));
    }

    private List<PaymentLogDTO> getPaymentLogsByUserPlanId(String userPlanId) {
        logger.info("Getting payment logs for user plan ID: {}", userPlanId);

        List<PaymentLog> paymentLogs = paymentLogRepository.findByUserPlanIdOrderByCreatedAtDesc(userPlanId);

        List<PaymentLogDTO> paymentLogDTOs = paymentLogs.stream()
                .map(PaymentLog::mapToDTO)
                .collect(Collectors.toList());

        logger.info("Retrieved {} payment logs for user plan ID: {}", paymentLogDTOs.size(), userPlanId);
        return paymentLogDTOs;
    }

    @Cacheable(value = "userPlansByUser", key = "#userPlanFilterDTO.userId + ':' + #userPlanFilterDTO.instituteId + ':' + #pageNo + ':' + #pageSize + ':' + #userPlanFilterDTO.statuses + ':' + #userPlanFilterDTO.sortColumns")
    public Page<UserPlanDTO> getUserPlansByUserIdAndInstituteId(int pageNo, int pageSize,
            UserPlanFilterDTO userPlanFilterDTO) {
        logger.info("Getting paginated UserPlans for userId={}, instituteId={}", userPlanFilterDTO.getUserId(),
                userPlanFilterDTO.getInstituteId());
        Sort thisSort = ListService.createSortObject(userPlanFilterDTO.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo, pageSize, thisSort);
        List<String> status = List.of(UserPlanStatusEnum.ACTIVE.name(), UserPlanStatusEnum.PENDING.name(),
                UserPlanStatusEnum.PENDING_FOR_PAYMENT.name(), UserPlanStatusEnum.CANCELED.name(),
                UserPlanStatusEnum.EXPIRED.name(), UserPlanStatusEnum.PAYMENT_FAILED.name());
        Page<UserPlan> userPlansPage = userPlanRepository.findByUserIdAndInstituteIdWithFilters(
                userPlanFilterDTO.getUserId(), userPlanFilterDTO.getInstituteId(), status, pageable);

        // Bulk fetch Institutes for all SUB_ORG plans
        List<UserPlan> userPlans = userPlansPage.getContent();
        Map<String, Institute> instituteMap = fetchInstitutes(userPlans);

        return userPlansPage.map(userPlan -> mapToDTO(userPlan, instituteMap));
    }

    /**
     * Fetch all Institutes in bulk for UserPlans with SUB_ORG source.
     * This prevents N+1 query problem.
     */
    private Map<String, Institute> fetchInstitutes(List<UserPlan> userPlans) {
        Set<String> subOrgIds = userPlans.stream()
                .filter(up -> UserPlanSourceEnum.SUB_ORG.name().equals(up.getSource()))
                .map(UserPlan::getSubOrgId)
                .filter(StringUtils::hasText)
                .collect(Collectors.toSet());

        if (subOrgIds.isEmpty()) {
            return Collections.emptyMap();
        }

        logger.debug("Fetching {} institutes in bulk for subOrgIds: {}", subOrgIds.size(), subOrgIds);

        // findAllById returns Iterable, convert it to List
        Iterable<Institute> iterableInstitutes = instituteRepository.findAllById(subOrgIds);
        List<Institute> institutes = new ArrayList<>();
        iterableInstitutes.forEach(institutes::add);

        return institutes.stream()
                .collect(Collectors.toMap(
                        Institute::getId,
                        i -> i,
                        (existing, replacement) -> existing));
    }

    /**
     * Map UserPlan to DTO with Institute details from pre-fetched map.
     * This version is used for bulk operations to avoid N+1 queries.
     */
    private UserPlanDTO mapToDTO(UserPlan userPlan, Map<String, Institute> instituteMap) {
        // Fetch sub-org details from the pre-fetched map
        SubOrgDetailsDTO subOrgDetails = null;
        if (UserPlanSourceEnum.SUB_ORG.name().equals(userPlan.getSource()) &&
                StringUtils.hasText(userPlan.getSubOrgId())) {
            Institute institute = instituteMap.get(userPlan.getSubOrgId());
            if (institute != null) {
                subOrgDetails = SubOrgDetailsDTO.builder()
                        .id(institute.getId())
                        .name(institute.getInstituteName())
                        .address(institute.getAddress())
                        .build();
            } else {
                logger.warn("Institute not found in map for subOrgId={} in UserPlan ID={}",
                        userPlan.getSubOrgId(), userPlan.getId());
            }
        }

        return buildUserPlanDTO(userPlan, subOrgDetails);
    }

    /**
     * Map UserPlan to DTO (individual fetch version).
     * This version is used for single UserPlan operations.
     */
    private UserPlanDTO mapToDTO(UserPlan userPlan) {
        // Fetch sub-org details if source is SUB_ORG and subOrgId is present
        SubOrgDetailsDTO subOrgDetails = null;
        if (UserPlanSourceEnum.SUB_ORG.name().equals(userPlan.getSource()) &&
                StringUtils.hasText(userPlan.getSubOrgId())) {
            Optional<Institute> instituteOpt = instituteRepository.findById(userPlan.getSubOrgId());
            if (instituteOpt.isPresent()) {
                Institute institute = instituteOpt.get();
                subOrgDetails = SubOrgDetailsDTO.builder()
                        .id(institute.getId())
                        .name(institute.getInstituteName())
                        .address(institute.getAddress())
                        .build();
            } else {
                logger.warn("Institute not found for subOrgId={} in UserPlan ID={}",
                        userPlan.getSubOrgId(), userPlan.getId());
            }
        }

        return buildUserPlanDTO(userPlan, subOrgDetails);
    }

    /**
     * Build UserPlanDTO with all fields.
     * Common logic extracted to avoid duplication.
     */
    private UserPlanDTO buildUserPlanDTO(UserPlan userPlan, SubOrgDetailsDTO subOrgDetails) {
        return UserPlanDTO.builder()
                .id(userPlan.getId())
                .userId(userPlan.getUserId())
                .paymentPlanId(userPlan.getPaymentPlanId())
                .planJson(userPlan.getPlanJson())
                .appliedCouponDiscountId(userPlan.getAppliedCouponDiscountId())
                .appliedCouponDiscountJson(userPlan.getAppliedCouponDiscountJson())
                .enrollInviteId(userPlan.getEnrollInviteId())
                .paymentOptionId(userPlan.getPaymentOptionId())
                .paymentOptionJson(userPlan.getPaymentOptionJson())
                .status(userPlan.getStatus())
                .source(userPlan.getSource())
                .subOrgDetails(subOrgDetails)
                .createdAt(userPlan.getCreatedAt())
                .updatedAt(userPlan.getUpdatedAt())
                .startDate(userPlan.getStartDate())
                .endDate(userPlan.getEndDate())
                .enrollInvite(userPlan.getEnrollInvite().toEnrollInviteDTO())
                .paymentPlanDTO(
                        (userPlan.getPaymentPlan() != null ? userPlan.getPaymentPlan().mapToPaymentPlanDTO() : null))
                .paymentOption(
                        (userPlan.getPaymentOption() != null ? userPlan.getPaymentOption().mapToPaymentOptionDTO()
                                : null))
                .paymentLogs((userPlan.getPaymentLogs() != null
                        ? userPlan.getPaymentLogs().stream().map(PaymentLog::mapToDTO).collect(Collectors.toList())
                        : List.of()))
                .policyDetails(buildPolicyDetailsForUserPlan(userPlan))
                .build();
    }

    /**
     * Map UserPlan to DTO WITHOUT payment logs (optimized for membership details).
     * This method avoids loading payment logs for better performance.
     */
    /**
     * Map UserPlan to DTO WITHOUT payment logs (optimized for membership details).
     * This method avoids loading payment logs for better performance.
     */
    private UserPlanDTO mapToDTOWithoutPaymentLogs(UserPlan userPlan,
            List<PackageSessionPolicyDetailsDTO> policyDetails) {
        // Fetch sub-org details if source is SUB_ORG and subOrgId is present
        SubOrgDetailsDTO subOrgDetails = null;
        if (UserPlanSourceEnum.SUB_ORG.name().equals(userPlan.getSource()) &&
                StringUtils.hasText(userPlan.getSubOrgId())) {
            Optional<Institute> instituteOpt = instituteRepository.findById(userPlan.getSubOrgId());
            if (instituteOpt.isPresent()) {
                Institute institute = instituteOpt.get();
                subOrgDetails = SubOrgDetailsDTO.builder()
                        .id(institute.getId())
                        .name(institute.getInstituteName())
                        .address(institute.getAddress())
                        .build();
            } else {
                logger.warn("Institute not found for subOrgId={} in UserPlan ID={}",
                        userPlan.getSubOrgId(), userPlan.getId());
            }
        }

        // Build DTO without payment logs
        return UserPlanDTO.builder()
                .id(userPlan.getId())
                .userId(userPlan.getUserId())
                .paymentPlanId(userPlan.getPaymentPlanId())
                .planJson(userPlan.getPlanJson())
                .appliedCouponDiscountId(userPlan.getAppliedCouponDiscountId())
                .appliedCouponDiscountJson(userPlan.getAppliedCouponDiscountJson())
                .enrollInviteId(userPlan.getEnrollInviteId())
                .paymentOptionId(userPlan.getPaymentOptionId())
                .paymentOptionJson(userPlan.getPaymentOptionJson())
                .status(userPlan.getStatus())
                .source(userPlan.getSource())
                .subOrgDetails(subOrgDetails)
                .createdAt(userPlan.getCreatedAt())
                .updatedAt(userPlan.getUpdatedAt())
                .startDate(userPlan.getStartDate())
                .endDate(userPlan.getEndDate())
                .enrollInvite(
                        userPlan.getEnrollInvite() != null ? userPlan.getEnrollInvite().toEnrollInviteDTO() : null)
                .paymentPlanDTO(
                        (userPlan.getPaymentPlan() != null ? userPlan.getPaymentPlan().mapToPaymentPlanDTO() : null))
                .paymentOption(
                        (userPlan.getPaymentOption() != null ? userPlan.getPaymentOption().mapToPaymentOptionDTO()
                                : null))
                .paymentLogs(List.of()) // Empty list - no payment logs loaded
                .policyDetails(policyDetails) // Set policy details
                .build();
    }

    @CacheEvict(value = { "userPlanById", "userPlansByUser", "userPlanWithPaymentLogs",
            "membershipDetails" }, allEntries = true)
    public void updateUserPlanStatuses(List<String> userPlanIds, String status) {
        if (CollectionUtils.isEmpty(userPlanIds)) {
            throw new IllegalArgumentException("User plan ids must not be empty.");
        }

        if (!StringUtils.hasText(status)) {
            throw new IllegalArgumentException("Status must not be empty.");
        }

        String normalizedStatus;
        try {
            normalizedStatus = UserPlanStatusEnum.valueOf(status.trim().toUpperCase(Locale.ROOT)).name();
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid user plan status: " + status);
        }

        List<UserPlan> userPlans = userPlanRepository.findAllById(userPlanIds);
        if (CollectionUtils.isEmpty(userPlans)) {
            throw new IllegalArgumentException("No user plans found for provided ids.");
        }

        userPlans.forEach(plan -> plan.setStatus(normalizedStatus));
        userPlanRepository.saveAll(userPlans);
    }

    /**
     * Activates a stacked PENDING plan when the current plan expires.
     * 1. Updates stacked plan status to ACTIVE.
     * 2. Sets stacked plan start/end dates based on current time and validity.
     * 3. Moves all active mappings from expired plan to stacked plan and extends
     * their expiry.
     */
    @Transactional
    public void activateStackedPlan(UserPlan stackedPlan, UserPlan expiredPlan) {
        logger.info("Activating stacked plan ID={} (replacing expired plan ID={})", stackedPlan.getId(),
                expiredPlan.getId());

        // 1. Update Stacked Plan Dates
        Date now = new Date();
        stackedPlan.setStartDate(new Timestamp(now.getTime()));

        // Calculate validity
        Integer validityDays = null;
        if (stackedPlan.getPaymentPlan() != null && stackedPlan.getPaymentPlan().getValidityInDays() != null) {
            validityDays = stackedPlan.getPaymentPlan().getValidityInDays();
        } else if (stackedPlan.getEnrollInvite() != null
                && stackedPlan.getEnrollInvite().getLearnerAccessDays() != null) {
            validityDays = stackedPlan.getEnrollInvite().getLearnerAccessDays();
        }

        if (validityDays != null) {
            Calendar calendar = Calendar.getInstance();
            calendar.setTime(now);
            calendar.add(Calendar.DAY_OF_YEAR, validityDays);
            stackedPlan.setEndDate(new Timestamp(calendar.getTimeInMillis()));
        }

        // 2. Update Status
        stackedPlan.setStatus(UserPlanStatusEnum.ACTIVE.name());
        userPlanRepository.save(stackedPlan);

        // 3. Transfer and Extend Mappings
        List<StudentSessionInstituteGroupMapping> mappings = studentSessionRepository.findAllByUserPlanIdAndStatusIn(
                expiredPlan.getId(),
                List.of(LearnerSessionStatusEnum.ACTIVE.name()));

        if (mappings.isEmpty()) {
            logger.warn("No active mappings found for expired plan ID={}. Nothing to transfer.", expiredPlan.getId());
            return;
        }

        for (StudentSessionInstituteGroupMapping mapping : mappings) {
            // Link to new plan
            mapping.setUserPlanId(stackedPlan.getId());

            // Extend expiry date to match the new plan's end date
            // This ensures the mapping is valid for the duration of the new plan
            if (stackedPlan.getEndDate() != null) {
                mapping.setExpiryDate(stackedPlan.getEndDate());
            }

            studentSessionRepository.save(mapping);
        }

        logger.info("Transferred {} mappings from plan {} to plan {}", mappings.size(), expiredPlan.getId(),
                stackedPlan.getId());
    }

    @Transactional
    public void cancelUserPlan(String userPlanId, boolean force) {
        logger.info("Cancelling UserPlan ID: {}, force: {}", userPlanId, force);

        UserPlan userPlan = userPlanRepository.findById(userPlanId)
                .orElseThrow(() -> new RuntimeException("UserPlan not found with ID: " + userPlanId));

        userPlan.setStatus(force ? UserPlanStatusEnum.TERMINATED.name() : UserPlanStatusEnum.CANCELED.name());
        userPlanRepository.save(userPlan);

        if (!force) {
            logger.info("UserPlan ID: {} marked as CANCELED", userPlanId);

            // Inactivate all associated mappings to "deroll" the user
            List<StudentSessionInstituteGroupMapping> mappings = studentSessionRepository
                    .findAllByUserPlanIdAndStatusIn(
                            userPlanId,
                            List.of(LearnerSessionStatusEnum.ACTIVE.name()));

            for (StudentSessionInstituteGroupMapping mapping : mappings) {
                mapping.setStatus(LearnerSessionStatusEnum.INACTIVE.name());
            }
            studentSessionRepository.saveAll(mappings);
            logger.info("Inactivated {} mappings for CANCELED UserPlan ID: {}", mappings.size(), userPlanId);
            return;
        }

        logger.info("UserPlan ID: {} marked as TERMINATED", userPlanId);

        List<StudentSessionInstituteGroupMapping> mappings = studentSessionRepository.findAllByUserPlanIdAndStatusIn(
                userPlanId,
                List.of(LearnerSessionStatusEnum.ACTIVE.name()));

        if (mappings.isEmpty()) {
            logger.warn("No session mappings found for UserPlan ID: {}", userPlanId);
            return;
        }

        // Extract packageIds
        Set<String> packageIds = mappings.stream()
                .map(StudentSessionInstituteGroupMapping::getPackageSession)
                .filter(Objects::nonNull)
                .map(ps -> ps.getPackageEntity().getId())
                .collect(Collectors.toSet());

        if (packageIds.isEmpty()) {
            studentSessionRepository.deleteAllInBatch(mappings);
            logger.info("Deleted {} mappings (no package sessions)", mappings.size());
            return;
        }

        // Fetch all invited sessions in one query
        Map<String, PackageSession> invitedSessionByPackageId = packageSessionRepository
                .findAllInvitedByPackageIds(packageIds)
                .stream()
                .collect(Collectors.toMap(
                        ps -> ps.getPackageEntity().getId(),
                        Function.identity()));

        List<StudentSessionInstituteGroupMapping> newMappings = new ArrayList<>();

        for (StudentSessionInstituteGroupMapping mapping : mappings) {
            PackageSession activePackageSession = mapping.getPackageSession();
            if (activePackageSession == null)
                continue;

            String packageId = activePackageSession.getPackageEntity().getId();
            PackageSession invitedSession = invitedSessionByPackageId.get(packageId);

            if (invitedSession == null) {
                logger.error(
                        "INVITED package session not found for package ID: {}. Mapping ID: {}",
                        packageId, mapping.getId());
                continue;
            }

            newMappings.add(
                    StudentSessionInstituteGroupMapping.createInvitedMappingFromTerminated(
                            mapping,
                            invitedSession,
                            activePackageSession,
                            LearnerSessionSourceEnum.TERMINATED.name(),
                            LearnerSessionTypeEnum.PACKAGE_SESSION.name(),
                            LearnerSessionStatusEnum.INVITED.name()));
        }

        // Bulk delete + bulk insert
        studentSessionRepository.deleteAllInBatch(mappings);
        studentSessionRepository.saveAll(newMappings);

        logger.info("Force-cancel completed. Deleted: {}, Created INVITED mappings: {}", mappings.size(),
                newMappings.size());
    }

    /**
     * Get membership details with caching and optimizations.
     * - Uses caching to reduce database load
     * - Avoids loading payment logs for better performance
     * - Fetches only necessary associations
     */
    @Cacheable(value = "membershipDetails", key = "#filterDTO.instituteId + '_' + #pageNo + '_' + #pageSize + '_' + " +
            "#filterDTO.startDateInUtc + '_' + #filterDTO.endDateInUtc + '_' + " +
            "(#filterDTO.membershipStatuses != null ? #filterDTO.membershipStatuses.toString() : 'null') + '_' + " +
            "(#filterDTO.packageSessionIds != null ? #filterDTO.packageSessionIds.toString() : 'null') + '_' + " +
            "(#filterDTO.sortOrder != null ? #filterDTO.sortOrder.toString() : 'null')", unless = "#result == null || #result.isEmpty()")
    public Page<MembershipDetailsDTO> getMembershipDetails(MembershipFilterDTO filterDTO, int pageNo, int pageSize) {
        Pageable pageable = createPageable(pageNo, pageSize, filterDTO.getSortOrder());

        // 1. Fetch Data with Dynamic Status Calculation
        Page<Object[]> results = userPlanRepository.findMembershipDetailsWithDynamicStatus(
                filterDTO.getInstituteId(),
                filterDTO.getStartDateInUtc(),
                filterDTO.getEndDateInUtc(),
                filterDTO.getMembershipStatuses(),
                filterDTO.getPackageSessionIds(),
                pageable);

        // 2. Extract User Plan IDs to fetch entities in bulk
        List<Object[]> content = results.getContent();
        List<String> userPlanIds = content.stream()
                .map(row -> (String) row[0]) // row[0] is the user_plan.id (String)
                .collect(Collectors.toList());

        // 3. Fetch UserPlan entities by IDs WITHOUT payment logs (optimized)
        Map<String, UserPlan> userPlanMap = new HashMap<>();
        if (!userPlanIds.isEmpty()) {
            List<UserPlan> userPlans = userPlanRepository.findByIdsWithoutPaymentLogs(userPlanIds);
            userPlanMap = userPlans.stream()
                    .collect(Collectors.toMap(UserPlan::getId, Function.identity()));
        }

        // 4. Extract User IDs from fetched UserPlan entities
        Set<String> userIds = userPlanMap.values().stream()
                .map(UserPlan::getUserId)
                .collect(Collectors.toSet());

        // 5. Fetch User DTOs from Auth Service
        Map<String, UserDTO> userMap = new HashMap<>();
        if (!userIds.isEmpty()) {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(userIds));
            userMap = users.stream().collect(Collectors.toMap(UserDTO::getId, Function.identity()));
        }

        // 6. Fetch Package Sessions
        Set<String> enrollInviteIds = userPlanMap.values().stream()
                .map(UserPlan::getEnrollInviteId)
                .collect(Collectors.toSet());

        Map<String, List<PackageSessionLiteDTO>> sessionMap = new HashMap<>();
        if (!enrollInviteIds.isEmpty()) {
            List<PackageSessionLearnerInvitationToPaymentOption> mappings = packageSessionEnrollInviteToPaymentOptionService
                    .findByEnrollInviteIdsWithPackageSession(new ArrayList<>(enrollInviteIds));

            Map<String, List<PackageSessionLearnerInvitationToPaymentOption>> grouped = mappings.stream()
                    .filter(m -> m.getPaymentOption() != null)
                    .collect(Collectors.groupingBy(m -> m.getPaymentOption().getId()));

            sessionMap = grouped.entrySet().stream().collect(Collectors.toMap(
                    Map.Entry::getKey,
                    entry -> entry.getValue().stream().map(m -> {
                        vacademy.io.common.institute.entity.session.PackageSession ps = m.getPackageSession();
                        return PackageSessionLiteDTO.builder()
                                .id(ps.getId())
                                .sessionName(ps.getSession() != null ? ps.getSession().getSessionName() : null)
                                .packageName(
                                        ps.getPackageEntity() != null ? ps.getPackageEntity().getPackageName() : null)
                                .levelName(ps.getLevel() != null ? ps.getLevel().getLevelName() : null)
                                .startTime(ps.getStartTime())
                                .status(ps.getStatus())
                                .build();
                    }).collect(Collectors.toList())));
        }

        // 7. Fetch Policy Data (Bulk)
        Map<String, List<PackageSessionLearnerInvitationToPaymentOption>> enrollInviteToSessionsMap = new HashMap<>();
        if (!enrollInviteIds.isEmpty()) {
            List<PackageSessionLearnerInvitationToPaymentOption> allMappings = packageSessionLearnerInvitationRepository
                    .findByEnrollInviteIdsAndStatusWithPackageSession(
                            new ArrayList<>(enrollInviteIds),
                            List.of("ACTIVE"));

            enrollInviteToSessionsMap = allMappings.stream()
                    .collect(Collectors.groupingBy(m -> m.getEnrollInvite().getId()));
        }

        // 8. Map to MembershipDetailsDTO (without payment logs)
        Map<String, UserPlan> finalUserPlanMap = userPlanMap;
        Map<String, UserDTO> finalUserMap = userMap;
        Map<String, List<PackageSessionLiteDTO>> finalSessionMap = sessionMap;
        Map<String, List<PackageSessionLearnerInvitationToPaymentOption>> finalEnrollInviteToSessionsMap = enrollInviteToSessionsMap;

        return results.map(row -> {
            String userPlanId = (String) row[0]; // user_plan.id
            String dynamicStatus = (String) row[1]; // computedStatus
            Timestamp endDate = (Timestamp) row[2]; // actualEndDate

            UserPlan userPlan = finalUserPlanMap.get(userPlanId);
            if (userPlan == null) {
                throw new RuntimeException("UserPlan not found for id: " + userPlanId);
            }

            // Build policy details
            List<PackageSessionPolicyDetailsDTO> policyDetails = null;
            List<PackageSessionLearnerInvitationToPaymentOption> sessionMappings = finalEnrollInviteToSessionsMap
                    .getOrDefault(userPlan.getEnrollInviteId(), Collections.emptyList());

            policyDetails = sessionMappings.stream()
                    .filter(m -> m.getPackageSession() != null)
                    .map(m -> buildDetailsForSession(userPlan, m.getPackageSession()))
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());

            // Map to DTO without payment logs, passing policy details
            UserPlanDTO userPlanDTO = mapToDTOWithoutPaymentLogs(userPlan, policyDetails);

            return MembershipDetailsDTO.builder()
                    .userPlan(userPlanDTO)
                    .userDetails(finalUserMap.get(userPlan.getUserId()))
                    .membershipStatus(dynamicStatus)
                    .calculatedEndDate(endDate)
                    .packageSessions(finalSessionMap.getOrDefault(userPlan.getPaymentOptionId(), List.of()))
                    .policyDetails(policyDetails)
                    .build();
        });
    }

    // Overloaded method for backward compatibility - now just calls the main method
    @Cacheable(value = "membershipDetails", key = "#filterDTO.instituteId + '_' + #pageNo + '_' + #pageSize + '_' + " +
            "#filterDTO.startDateInUtc + '_' + #filterDTO.endDateInUtc + '_' + " +
            "(#filterDTO.membershipStatuses != null ? #filterDTO.membershipStatuses.toString() : 'null') + '_' + " +
            "(#filterDTO.packageSessionIds != null ? #filterDTO.packageSessionIds.toString() : 'null') + '_' + " +
            "(#filterDTO.sortOrder != null ? #filterDTO.sortOrder.toString() : 'null')", unless = "#result == null || #result.isEmpty()")
    public Page<MembershipDetailsDTO> getMembershipDetailsCached(MembershipFilterDTO filterDTO, int pageNo,
            int pageSize) {
        return getMembershipDetails(filterDTO, pageNo, pageSize);
    }

    public Pageable createPageable(int page, int size, Map<String, String> sortCols) {
        if (sortCols != null && sortCols.containsKey("calculated_end_date")) {
            String direction = sortCols.remove("calculated_end_date");
            sortCols.put("end_date", direction);
        }
        Sort sort = ListService.createSortObject(sortCols);
        return PageRequest.of(page, size, sort);
    }

    /**
     * Builds policy details for a UserPlan.
     * Fetches all package sessions associated with the UserPlan's enrollInvite
     * and extracts policy information.
     *
     * @param userPlan The UserPlan to build policy details for
     * @return List of policy details, one per package session (empty if none)
     */
    private List<PackageSessionPolicyDetailsDTO> buildPolicyDetailsForUserPlan(UserPlan userPlan) {
        if (userPlan == null || userPlan.getEnrollInviteId() == null) {
            return Collections.emptyList();
        }

        try {
            List<PackageSessionLearnerInvitationToPaymentOption> mappings = packageSessionLearnerInvitationRepository
                    .findByEnrollInviteIdAndStatusWithPackageSession(
                            userPlan.getEnrollInviteId(),
                            List.of("ACTIVE"));

            if (mappings == null || mappings.isEmpty()) {
                return Collections.emptyList();
            }

            return mappings.stream()
                    .filter(m -> m.getPackageSession() != null)
                    .map(m -> buildDetailsForSession(userPlan, m.getPackageSession()))
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());

        } catch (Exception e) {
            logger.error("Error building policy details for UserPlan ID: {}", userPlan.getId(), e);
            return Collections.emptyList();
        }
    }

    private PackageSessionPolicyDetailsDTO buildDetailsForSession(UserPlan userPlan, PackageSession packageSession) {
        try {
            String policyJson = packageSession.getEnrollmentPolicySettings();
            if (!StringUtils.hasText(policyJson)) {
                return null;
            }

            EnrollmentPolicyJsonDTOs.EnrollmentPolicySettingsDTO settings = objectMapper.readValue(policyJson,
                    EnrollmentPolicyJsonDTOs.EnrollmentPolicySettingsDTO.class);

            List<PolicyActionDTO> actions = buildPolicyActions(userPlan, settings);
            ReenrollmentPolicyDetailsDTO reenrollment = buildReenrollmentPolicy(settings, userPlan);
            OnExpiryPolicyDetailsDTO onExpiry = buildOnExpiryPolicy(settings, userPlan);

            return PackageSessionPolicyDetailsDTO.builder()
                    .packageSessionId(packageSession.getId())
                    .packageSessionName(packageSession.getLevel().getLevelName() + " "
                            + packageSession.getPackageEntity().getPackageName() + " "
                            + packageSession.getSession().getSessionName())
                    .packageSessionStatus(packageSession.getStatus())
                    .policyActions(actions)
                    .reenrollmentPolicy(reenrollment)
                    .onExpiryPolicy(onExpiry)
                    .build();
        } catch (Exception e) {
            logger.error("Error parsing policy for session: {}", packageSession.getId(), e);
            return null;
        }
    }

    private List<PolicyActionDTO> buildPolicyActions(UserPlan userPlan,
            EnrollmentPolicyJsonDTOs.EnrollmentPolicySettingsDTO settings) {
        List<PolicyActionDTO> actions = new ArrayList<>();
        LocalDate endDate = userPlan.getEndDate() != null
                ? userPlan.getEndDate().toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDate()
                : null;

        if (endDate == null)
            return actions;

        // Notifications
        if (settings.getNotifications() != null) {
            for (EnrollmentPolicyJsonDTOs.NotificationConfigDTO config : settings.getNotifications()) {
                if ("ON_EXPIRY_DATE_REACHED".equals(config.getTrigger())) {
                    addSingleNotificationAction(actions, endDate, 0, "Expiry notification", config);
                } else if ("DURING_WAITING_PERIOD".equals(config.getTrigger())) {
                    addRecurringNotificationActions(actions, endDate, config);
                } else if ("BEFORE_EXPIRY".equals(config.getTrigger()) && config.getDaysBeforeExpiry() != null) {
                    LocalDate scheduledDate = endDate.minusDays(config.getDaysBeforeExpiry());
                    addSingleNotificationAction(actions, scheduledDate, -config.getDaysBeforeExpiry(),
                            "Reminder " + config.getDaysBeforeExpiry() + " days before expiry", config);
                }
            }
        }

        // Auto-renewal / Payment
        if (settings.getOnExpiry() != null && Boolean.TRUE.equals(settings.getOnExpiry().getEnableAutoRenewal())) {
            actions.add(PolicyActionDTO.builder()
                    .actionType("PAYMENT_ATTEMPT")
                    .scheduledDate(endDate)
                    .description("Auto-renewal payment attempt")
                    .daysPastOrBeforeExpiry(0)
                    .build());
        }

        // Final Expiry
        if (settings.getOnExpiry() != null && settings.getOnExpiry().getWaitingPeriodInDays() != null) {
            LocalDate finalExpiryDate = endDate.plusDays(settings.getOnExpiry().getWaitingPeriodInDays());
            actions.add(PolicyActionDTO.builder()
                    .actionType("FINAL_EXPIRY")
                    .scheduledDate(finalExpiryDate)
                    .description("Final expiry after waiting period")
                    .daysPastOrBeforeExpiry(settings.getOnExpiry().getWaitingPeriodInDays())
                    .build());
        }

        actions.sort(Comparator.comparing(PolicyActionDTO::getScheduledDate));
        return actions;
    }

    private void addSingleNotificationAction(List<PolicyActionDTO> actions, LocalDate scheduledDate, int daysDiff,
            String desc, EnrollmentPolicyJsonDTOs.NotificationConfigDTO config) {
        if (scheduledDate.isAfter(LocalDate.now())) {
            actions.add(PolicyActionDTO.builder()
                    .actionType("NOTIFICATION")
                    .scheduledDate(scheduledDate)
                    .description(desc)
                    .daysPastOrBeforeExpiry(daysDiff)
                    .details(buildNotificationDetails(config))
                    .build());
        }
    }

    private void addRecurringNotificationActions(List<PolicyActionDTO> actions, LocalDate endDate,
            EnrollmentPolicyJsonDTOs.NotificationConfigDTO config) {
        int interval = config.getSendEveryNDays() != null ? config.getSendEveryNDays() : 1;
        int maxSends = config.getMaxSends() != null ? config.getMaxSends() : 1;

        for (int i = 1; i <= maxSends; i++) {
            int daysAfter = i * interval;
            LocalDate scheduledDate = endDate.plusDays(daysAfter);
            if (scheduledDate.isAfter(LocalDate.now())) {
                actions.add(PolicyActionDTO.builder()
                        .actionType("NOTIFICATION")
                        .scheduledDate(scheduledDate)
                        .description("Follow-up " + daysAfter + " days after expiry")
                        .daysPastOrBeforeExpiry(daysAfter)
                        .details(buildNotificationDetails(config))
                        .build());
            }
        }
    }

    private Map<String, Object> buildNotificationDetails(EnrollmentPolicyJsonDTOs.NotificationConfigDTO config) {
        Map<String, Object> details = new HashMap<>();
        if (config.getNotificationConfig() != null) {
            details.put("type", config.getNotificationConfig().getType());
            // details.put("content", config.getNotificationConfig().getContent());
            String templateName = config.getNotificationConfig().getTemplateName();
            details.put("templateName", StringUtils.hasText(templateName) ? templateName : "DEFAULT_TEMPLATE");
        }
        return details;
    }

    private ReenrollmentPolicyDetailsDTO buildReenrollmentPolicy(
            EnrollmentPolicyJsonDTOs.EnrollmentPolicySettingsDTO settings, UserPlan userPlan) {
        if (settings.getReenrollmentPolicy() == null)
            return null;

        LocalDate nextEligible = null;
        if (userPlan.getEndDate() != null && settings.getReenrollmentPolicy().getReenrollmentGapInDays() != null) {
            nextEligible = userPlan.getEndDate().toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDate()
                    .plusDays(settings.getReenrollmentPolicy().getReenrollmentGapInDays());
        }

        return ReenrollmentPolicyDetailsDTO.builder()
                .allowReenrollmentAfterExpiry(settings.getReenrollmentPolicy().getAllowReenrollmentAfterExpiry())
                .reenrollmentGapInDays(settings.getReenrollmentPolicy().getReenrollmentGapInDays())
                .nextEligibleEnrollmentDate(nextEligible)
                .build();
    }

    private OnExpiryPolicyDetailsDTO buildOnExpiryPolicy(EnrollmentPolicyJsonDTOs.EnrollmentPolicySettingsDTO settings,
            UserPlan userPlan) {
        if (settings.getOnExpiry() == null)
            return null;

        LocalDate endDate = userPlan.getEndDate() != null
                ? userPlan.getEndDate().toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDate()
                : null;
        LocalDate finalExpiry = null;
        LocalDate nextPayment = null;

        if (endDate != null) {
            if (settings.getOnExpiry().getWaitingPeriodInDays() != null) {
                finalExpiry = endDate.plusDays(settings.getOnExpiry().getWaitingPeriodInDays());
            }
            if (Boolean.TRUE.equals(settings.getOnExpiry().getEnableAutoRenewal())) {
                nextPayment = endDate;
            }
        }

        return OnExpiryPolicyDetailsDTO.builder()
                .waitingPeriodInDays(settings.getOnExpiry().getWaitingPeriodInDays())
                .enableAutoRenewal(settings.getOnExpiry().getEnableAutoRenewal())
                .nextPaymentAttemptDate(nextPayment)
                .finalExpiryDate(finalExpiry)
                .build();
    }

    public UserPlan save(UserPlan userPlan) {
        return userPlanRepository.save(userPlan);
    }
}
