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
import vacademy.io.admin_core_service.features.enroll_invite.service.PackageSessionEnrollInviteToPaymentOptionService;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerBatchEnrollService;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.notification.service.DynamicNotificationService;
import vacademy.io.admin_core_service.features.user_subscription.dto.*;
import vacademy.io.admin_core_service.features.user_subscription.entity.*;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanSourceEnum;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
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

    public UserPlan createUserPlan(String userId,
            PaymentPlan paymentPlan,
            AppliedCouponDiscount appliedCouponDiscount,
            EnrollInvite enrollInvite,
            PaymentOption paymentOption,
            PaymentInitiationRequestDTO paymentInitiationRequestDTO,
            String status) {
        return createUserPlan(userId, paymentPlan, appliedCouponDiscount, enrollInvite,
                paymentOption, paymentInitiationRequestDTO, status, null, null);
    }

    public UserPlan createUserPlan(String userId,
            PaymentPlan paymentPlan,
            AppliedCouponDiscount appliedCouponDiscount,
            EnrollInvite enrollInvite,
            PaymentOption paymentOption,
            PaymentInitiationRequestDTO paymentInitiationRequestDTO,
            String status,
            String source,
            String subOrgId) {
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

        // Set source and sub_org_id if provided
        if (source != null) {
            userPlan.setSource(source);
        } else {
            // Default to USER if not specified
            userPlan.setSource(UserPlanSourceEnum.USER.name());
        }

        if (subOrgId != null) {
            userPlan.setSubOrgId(subOrgId);
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
            // No existing plan, use now
            effectiveStartDate = new Date();
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

    @Cacheable(value = "userPlanWithPaymentLogs", key = "#userPlanId")
    public UserPlanDTO getUserPlanWithPaymentLogs(String userPlanId) {
        logger.info("Getting UserPlan with payment logs for ID: {}", userPlanId);

        UserPlan userPlan = userPlanRepository.findById(userPlanId)
                .orElseThrow(() -> new RuntimeException("UserPlan not found with ID: " + userPlanId));

        // Get payment logs sorted by creation date in descending order
        List<PaymentLogDTO> paymentLogs = getPaymentLogsByUserPlanId(userPlanId);

        // Convert UserPlan to DTO
        UserPlanDTO userPlanDTO = mapToDTO(userPlan);
        userPlanDTO.setPaymentLogs(paymentLogs);

        logger.info("Retrieved UserPlan with {} payment logs for ID: {}", paymentLogs.size(), userPlanId);
        return userPlanDTO;
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
        List<String> status = userPlanFilterDTO.getStatuses();
        if (status == null) {
            status = List.of();
        }
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
                .build();
    }

    /**
     * Map UserPlan to DTO WITHOUT payment logs (optimized for membership details).
     * This method avoids loading payment logs for better performance.
     */
    private UserPlanDTO mapToDTOWithoutPaymentLogs(UserPlan userPlan) {
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
     * Get membership details with caching and optimizations.
     * - Uses caching to reduce database load
     * - Avoids loading payment logs for better performance
     * - Fetches only necessary associations
     */
    @Cacheable(value = "membershipDetails", key = "#filterDTO.instituteId + '_' + #pageNo + '_' + #pageSize + '_' + " +
            "#filterDTO.startDateInUtc + '_' + #filterDTO.endDateInUtc + '_' + " +
            "(#filterDTO.membershipStatuses != null ? #filterDTO.membershipStatuses.toString() : 'null') + '_' + " +
            "(#filterDTO.sortOrder != null ? #filterDTO.sortOrder.toString() : 'null')", unless = "#result == null || #result.isEmpty()")
    public Page<MembershipDetailsDTO> getMembershipDetails(MembershipFilterDTO filterDTO, int pageNo, int pageSize) {
        Pageable pageable = createPageable(pageNo, pageSize, filterDTO.getSortOrder());

        // 1. Fetch Data with Dynamic Status Calculation
        Page<Object[]> results = userPlanRepository.findMembershipDetailsWithDynamicStatus(
                filterDTO.getInstituteId(),
                filterDTO.getStartDateInUtc(),
                filterDTO.getEndDateInUtc(),
                filterDTO.getMembershipStatuses(),
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

        // 6. Map to MembershipDetailsDTO (without payment logs)
        Map<String, UserPlan> finalUserPlanMap = userPlanMap;
        Map<String, UserDTO> finalUserMap = userMap;
        return results.map(row -> {
            String userPlanId = (String) row[0]; // user_plan.id
            String dynamicStatus = (String) row[1]; // computedStatus
            Timestamp endDate = (Timestamp) row[2]; // actualEndDate

            UserPlan userPlan = finalUserPlanMap.get(userPlanId);
            if (userPlan == null) {
                throw new RuntimeException("UserPlan not found for id: " + userPlanId);
            }

            // Map to DTO without payment logs
            UserPlanDTO userPlanDTO = mapToDTOWithoutPaymentLogs(userPlan);

            return MembershipDetailsDTO.builder()
                    .userPlan(userPlanDTO)
                    .userDetails(finalUserMap.get(userPlan.getUserId()))
                    .membershipStatus(dynamicStatus)
                    .calculatedEndDate(endDate)
                    .build();
        });
    }

    public Pageable createPageable(int page, int size, Map<String, String> sortCols) {
        Sort sort = ListService.createSortObject(sortCols);
        return PageRequest.of(page, size, sort);
    }

    @Transactional
    public void activateStackedPlan(UserPlan stackedPlan, UserPlan expiredPlan) {
        logger.info("Activating stacked plan ID={} after expiry of plan ID={}", stackedPlan.getId(),
                expiredPlan.getId());

        // 1. Determine validity of the stacked plan
        Integer validityDays = null;
        if (stackedPlan.getPaymentPlan() != null && stackedPlan.getPaymentPlan().getValidityInDays() != null) {
            validityDays = stackedPlan.getPaymentPlan().getValidityInDays();
        } else if (stackedPlan.getEnrollInvite() != null
                && stackedPlan.getEnrollInvite().getLearnerAccessDays() != null) {
            validityDays = stackedPlan.getEnrollInvite().getLearnerAccessDays();
        }

        // 2. Set new dates
        // Start date = Expiry date of previous plan (or now if null)
        Date newStartDate = expiredPlan.getEndDate();
        if (newStartDate == null) {
            newStartDate = new Date();
        }
        stackedPlan.setStartDate(new Timestamp(newStartDate.getTime()));

        if (validityDays != null) {
            long validityMillis = validityDays * 24L * 60L * 60L * 1000L;
            stackedPlan.setEndDate(new Timestamp(newStartDate.getTime() + validityMillis));
        }

        // 3. Update status to ACTIVE
        stackedPlan.setStatus(UserPlanStatusEnum.ACTIVE.name());
        userPlanRepository.save(stackedPlan);

        // 4. Transfer active mappings from expired plan to stacked plan
        // We want to keep the learner in the SAME batch/session, just update the
        // userPlanId and expiry
        List<StudentSessionInstituteGroupMapping> activeMappings = studentSessionRepository
                .findAllByUserPlanIdAndStatusActive(expiredPlan.getId());

        if (activeMappings.isEmpty()) {
            logger.warn(
                    "No active mappings found for expired plan ID={}. Stacked plan activated but no sessions linked.",
                    expiredPlan.getId());
            return;
        }

        for (StudentSessionInstituteGroupMapping mapping : activeMappings) {
            // Update userPlanId
            mapping.setUserPlanId(stackedPlan.getId());

            // Extend expiry date of the mapping
            if (validityDays != null) {
                // Set mapping expiry to match the stacked plan's end date
                // This ensures the mapping is valid exactly as long as the plan is
                mapping.setExpiryDate(stackedPlan.getEndDate());
            }

            // Ensure status is ACTIVE
            mapping.setStatus(LearnerSessionStatusEnum.ACTIVE.name());

            studentSessionRepository.save(mapping);
        }

        logger.info("Stacked plan activated. {} mappings transferred and extended.", activeMappings.size());
    }
}

