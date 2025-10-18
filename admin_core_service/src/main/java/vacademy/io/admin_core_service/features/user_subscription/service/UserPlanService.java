package vacademy.io.admin_core_service.features.user_subscription.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.service.PackageSessionEnrollInviteToPaymentOptionService;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerBatchEnrollService;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.UserPlanDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.UserPlanFilterDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.*;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;

import java.util.List;
import java.util.stream.Collectors;

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

    public UserPlan createUserPlan(String userId,
            PaymentPlan paymentPlan,
            AppliedCouponDiscount appliedCouponDiscount,
            EnrollInvite enrollInvite,
            PaymentOption paymentOption,
            PaymentInitiationRequestDTO paymentInitiationRequestDTO,
            String status) {
        logger.info("Creating UserPlan for userId={}, status={}", userId, status);

        UserPlan userPlan = new UserPlan();
        userPlan.setStatus(status);
        userPlan.setUserId(userId);

        setPaymentPlan(userPlan, paymentPlan);
        setAppliedCouponDiscount(userPlan, appliedCouponDiscount);
        setEnrollInvite(userPlan, enrollInvite);
        setPaymentOption(userPlan, paymentOption);

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

        if (userPlan.getStatus().equalsIgnoreCase(UserPlanStatusEnum.ACTIVE.name())) {
            logger.info("UserPlan already ACTIVE. Skipping re-activation.");
            return;
        }

        EnrollInvite enrollInvite = userPlan.getEnrollInvite();

        List<String> packageSessionIds = packageSessionEnrollInviteToPaymentOptionService
                .findPackageSessionsOfEnrollInvite(enrollInvite);
        logger.debug("Package session IDs resolved for EnrollInvite ID={}: {}", enrollInvite.getId(),
                packageSessionIds);
        learnerBatchEnrollService.shiftLearnerFromInvitedToActivePackageSessions(packageSessionIds,
                userPlan.getUserId(), enrollInvite.getId());
        userPlan.setStatus(UserPlanStatusEnum.ACTIVE.name());
        userPlanRepository.save(userPlan);

        logger.info("UserPlan status updated to ACTIVE and saved. ID={}", userPlan.getId());
    }

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

    private UserPlanDTO mapToDTO(UserPlan userPlan) {
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
                .createdAt(userPlan.getCreatedAt())
                .updatedAt(userPlan.getUpdatedAt())
                .enrollInvite(userPlan.getEnrollInvite().toEnrollInviteDTO())
                .paymentPlanDTO((userPlan.getPaymentPlan() != null ? userPlan.getPaymentPlan().mapToPaymentPlanDTO() : null))
                .paymentOption((userPlan.getPaymentOption() != null ? userPlan.getPaymentOption().mapToPaymentOptionDTO() : null))
                .paymentLogs((userPlan.getPaymentLogs() != null ? userPlan.getPaymentLogs().stream().map(PaymentLog::mapToDTO).collect(Collectors.toList()) : List.of()))
                .build();
    }

    public Page<UserPlanDTO> getUserPlansByUserIdAndInstituteId(int pageNo,int pageSize,UserPlanFilterDTO userPlanFilterDTO) {
        logger.info("Getting paginated UserPlans for userId={}, instituteId={}", userPlanFilterDTO.getUserId(), userPlanFilterDTO.getInstituteId());
        Sort thisSort = ListService.createSortObject(userPlanFilterDTO.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo, pageSize, thisSort);
        List<String>status = userPlanFilterDTO.getStatuses();
        if(status == null){
            status = List.of();
        }
        Page<UserPlan> userPlansPage = userPlanRepository.findByUserIdAndInstituteIdWithFilters(userPlanFilterDTO.getUserId(), userPlanFilterDTO.getInstituteId(), status, pageable);

        return userPlansPage.map(userPlan -> {
            UserPlanDTO userPlanDTO = mapToDTO(userPlan);
            return userPlanDTO;
        });
    }
}
