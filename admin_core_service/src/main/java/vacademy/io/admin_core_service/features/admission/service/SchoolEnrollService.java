package vacademy.io.admin_core_service.features.admission.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.admission.dto.SchoolEnrollRequestDTO;
import vacademy.io.admin_core_service.features.admission.dto.SchoolEnrollResponseDTO;
import vacademy.io.admin_core_service.features.admission.dto.SchoolPaymentDTO;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteService;
import vacademy.io.admin_core_service.features.fee_management.service.FeeLedgerAllocationService;
import vacademy.io.admin_core_service.features.fee_management.service.StudentFeePaymentGenerationService;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerBatchEnrollService;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentLogStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.ManualPaymentDTO;
import vacademy.io.common.payment.enums.PaymentGateway;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import java.math.BigDecimal;
import java.util.*;

/**
 * Service for enrolling students in the school system.
 * Mirrors the AdminDirectEnrollService pattern but uses CPO-based fee
 * structure.
 *
 * Flow:
 * 1. Create/get user via AuthService
 * 2. Validate enrollInviteId, paymentOptionId
 * 3. Create UserPlan (plan_id = null, status = ACTIVE)
 * 4. Create student + StudentSessionInstituteGroupMapping (via
 * LearnerBatchEnrollService)
 * 5. Generate StudentFeePayment rows from CPO template
 * 6. Handle offline payment (if payment_mode == OFFLINE)
 */
@Service
@Transactional
@Slf4j
public class SchoolEnrollService {

    @Autowired
    private AuthService authService;

    @Autowired
    private EnrollInviteService enrollInviteService;

    @Autowired
    private PaymentOptionService paymentOptionService;

    @Autowired
    private UserPlanService userPlanService;

    @Autowired
    private LearnerBatchEnrollService learnerBatchEnrollService;

    @Autowired
    private PaymentLogService paymentLogService;

    @Autowired
    private StudentFeePaymentGenerationService studentFeePaymentGenerationService;

    @Autowired
    private FeeLedgerAllocationService feeLedgerAllocationService;

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public SchoolEnrollResponseDTO enrollStudent(SchoolEnrollRequestDTO request) {
        log.info("Starting school enrollment for institute: {}", request.getInstituteId());

        // Step 1: Validate request
        validateRequest(request);

        // Step 2: Create or get existing user
        // sendCred = false: skip welcome email from auth_service during school
        // enrollment
        // Notifications for school enrollment should be handled separately
        UserDTO createdUser = authService.createUserFromAuthService(
                request.getUser(),
                request.getInstituteId(),
                false);
        log.info("User created/retrieved: {}", createdUser.getId());

        // Step 3: Validate EnrollInvite and PaymentOption
        EnrollInvite enrollInvite = enrollInviteService.findById(request.getEnrollInviteId());
        PaymentOption paymentOption = paymentOptionService.findById(request.getPaymentOptionId());

        // Step 4: Extract startDate (default to today)
        Date enrollmentStartDate = request.getStartDate() != null ? request.getStartDate() : new Date();

        // Step 5: Create UserPlan (plan_id = null for school, status = ACTIVE)
        UserPlan userPlan = userPlanService.createUserPlan(
                createdUser.getId(),
                null, // paymentPlan = null for school
                null, // coupon = null
                enrollInvite,
                paymentOption,
                null, // paymentInitiationRequest = null (we handle payment separately)
                UserPlanStatusEnum.ACTIVE.name(),
                null, // source
                null, // subOrgId
                enrollmentStartDate);
        log.info("UserPlan created: {}", userPlan.getId());

        // DEBUG: flush to catch any pending SQL errors at this point
        entityManager.flush();
        log.info("DEBUG: Flush after UserPlan creation succeeded");

        // Step 6: Create student + StudentSessionInstituteGroupMapping
        List<InstituteStudentDetails> instituteStudentDetails = new ArrayList<>();
        instituteStudentDetails.add(InstituteStudentDetails.builder()
                .instituteId(request.getInstituteId())
                .packageSessionId(request.getPackageSessionId())
                .enrollmentStatus(LearnerStatusEnum.ACTIVE.name())
                .enrollmentDate(enrollmentStartDate)
                .accessDays(
                        enrollInvite.getLearnerAccessDays() != null
                                ? enrollInvite.getLearnerAccessDays().toString()
                                : null)
                .destinationPackageSessionId(null)
                .userPlanId(userPlan.getId())
                .build());

        learnerBatchEnrollService.checkAndCreateStudentAndAddToBatch(
                createdUser,
                request.getInstituteId(),
                instituteStudentDetails,
                request.getCustomFieldValues(),
                Map.of(),
                request.getLearnerExtraDetails(),
                enrollInvite);
        log.info("Student enrolled in batch for package session: {}", request.getPackageSessionId());

        // DEBUG: flush to catch any pending SQL errors at this point
        entityManager.flush();
        log.info("DEBUG: Flush after student batch enrollment succeeded");

        // Step 7: Generate StudentFeePayment rows from CPO template
        List<String> studentFeePaymentIds = new ArrayList<>();
        if (StringUtils.hasText(request.getCpoId())) {
            studentFeePaymentIds = studentFeePaymentGenerationService.generateFeeBills(
                    userPlan.getId(),
                    request.getCpoId(),
                    createdUser.getId());
            log.info("Generated {} fee bills from CPO: {}", studentFeePaymentIds.size(), request.getCpoId());
        }

        // Step 8: Handle payment (if provided)
        if (request.getSchoolPayment() != null) {
            handlePayment(request.getSchoolPayment(), createdUser, userPlan, enrollInvite);
        }

        // Build response
        return SchoolEnrollResponseDTO.builder()
                .userId(createdUser.getId())
                .userPlanId(userPlan.getId())
                .studentFeePaymentIds(studentFeePaymentIds)
                .message("Student enrolled successfully")
                .build();
    }

    private void validateRequest(SchoolEnrollRequestDTO request) {
        if (request.getUser() == null) {
            throw new VacademyException("User details are required");
        }
        if (!StringUtils.hasText(request.getInstituteId())) {
            throw new VacademyException("Institute ID is required");
        }
        if (!StringUtils.hasText(request.getPackageSessionId())) {
            throw new VacademyException("Package session ID is required");
        }
        if (!StringUtils.hasText(request.getEnrollInviteId())) {
            throw new VacademyException("Enroll invite ID is required");
        }
        if (!StringUtils.hasText(request.getPaymentOptionId())) {
            throw new VacademyException("Payment option ID is required");
        }
    }

    private void handlePayment(SchoolPaymentDTO payment, UserDTO user, UserPlan userPlan, EnrollInvite enrollInvite) {
        if ("OFFLINE".equalsIgnoreCase(payment.getPaymentMode())) {
            handleOfflinePayment(payment, user, userPlan, enrollInvite);
        } else if ("ONLINE".equalsIgnoreCase(payment.getPaymentMode())) {
            // Online payment flow — placeholder for future implementation
            log.info("Online payment mode selected. This will be implemented in a future iteration.");
            throw new VacademyException("Online payment for school enrollment is not yet supported");
        } else {
            throw new VacademyException("Invalid payment mode: " + payment.getPaymentMode()
                    + ". Supported modes: OFFLINE, ONLINE");
        }
    }

    /**
     * Handles offline/manual payment.
     * Mirrors AdminDirectEnrollService.handleManualPaymentIfAny()
     *
     * 1. Creates a PaymentLog with gateway = MANUAL, status = SUCCESS
     * 2. Calls FeeLedgerAllocationService.allocatePayment() for FIFO allocation
     */
    private void handleOfflinePayment(SchoolPaymentDTO payment, UserDTO user, UserPlan userPlan,
            EnrollInvite enrollInvite) {
        if (payment.getAmount() == null || payment.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Offline payment amount is zero or null. Skipping payment processing.");
            return;
        }

        ManualPaymentDTO manual = payment.getManualPayment();

        String currency = enrollInvite.getCurrency() != null ? enrollInvite.getCurrency() : "INR";

        // Create PaymentLog
        String paymentLogId = paymentLogService.createPaymentLog(
                user.getId(),
                payment.getAmount().doubleValue(),
                PaymentGateway.MANUAL.name(),
                PaymentGateway.MANUAL.name(),
                currency,
                userPlan);

        // Build payment-specific data for the log
        Map<String, Object> paymentSpecificData = new HashMap<>();
        paymentSpecificData.put("paymentMode", "OFFLINE");
        paymentSpecificData.put("amount", payment.getAmount());
        if (manual != null) {
            paymentSpecificData.put("manual", manual);
        }

        // Update payment log with SUCCESS status
        paymentLogService.updatePaymentLog(
                paymentLogId,
                PaymentLogStatusEnum.SUCCESS.name(),
                PaymentStatusEnum.PAID.name(),
                JsonUtil.toJson(paymentSpecificData));

        log.info("Created payment log {} for offline payment of {} {}", paymentLogId, payment.getAmount(), currency);

        // Allocate payment to StudentFeePayment bills (FIFO)
        feeLedgerAllocationService.allocatePayment(
                paymentLogId,
                payment.getAmount(),
                userPlan.getId());

        log.info("Offline payment of {} allocated to fee bills for UserPlan: {}", payment.getAmount(),
                userPlan.getId());
    }
}
