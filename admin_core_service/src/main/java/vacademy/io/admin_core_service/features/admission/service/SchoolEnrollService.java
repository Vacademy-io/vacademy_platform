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
import vacademy.io.admin_core_service.features.enroll_invite.repository.PackageSessionLearnerInvitationToPaymentOptionRepository;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteService;
import vacademy.io.admin_core_service.features.fee_management.repository.ComplexPaymentOptionRepository;
import vacademy.io.admin_core_service.features.fee_management.entity.ComplexPaymentOption;
import vacademy.io.admin_core_service.features.fee_management.service.FeeLedgerAllocationService;
import vacademy.io.admin_core_service.features.fee_management.service.SchoolFeeReceiptService;
import vacademy.io.admin_core_service.features.fee_management.service.StudentFeePaymentGenerationService;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerBatchEnrollService;
import vacademy.io.admin_core_service.features.payments.service.PaymentService;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentLogStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.ManualPaymentDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.enums.PaymentGateway;
import vacademy.io.common.payment.enums.PaymentStatusEnum;
import vacademy.io.common.payment.enums.PaymentType;

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

        @Autowired
        private SchoolFeeReceiptService schoolFeeReceiptService;

        @Autowired
        private PaymentService paymentService;

        @Autowired
        private PackageSessionLearnerInvitationToPaymentOptionRepository packageSessionLearnerInvitationRepository;

        @Autowired
        private ComplexPaymentOptionRepository complexPaymentOptionRepository;

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

                // Step 5: Create UserPlan (plan_id = null for school)
                // For online payment, start as PAYMENT_PENDING — becomes ACTIVE after webhook
                // confirms payment.
                // For offline, start as ACTIVE immediately since admin has cash in hand.
                boolean isOnline = request.getSchoolPayment() != null
                                && "ONLINE".equalsIgnoreCase(request.getSchoolPayment().getPaymentMode());
                String userPlanStatus = isOnline ? UserPlanStatusEnum.PENDING_FOR_PAYMENT.name()
                                : UserPlanStatusEnum.ACTIVE.name();
                String batchStatus = isOnline ? LearnerStatusEnum.INVITED.name() : LearnerStatusEnum.ACTIVE.name();

                UserPlan userPlan = userPlanService.createUserPlan(
                                createdUser.getId(),
                                null, // paymentPlan = null for school
                                null, // coupon = null
                                enrollInvite,
                                paymentOption,
                                null, // paymentInitiationRequest = null (we handle payment separately)
                                userPlanStatus,
                                null, // source
                                null, // subOrgId
                                enrollmentStartDate);
                log.info("UserPlan created: {}", userPlan.getId());

                // DEBUG: flush to catch any pending SQL errors at this point
                entityManager.flush();
                log.info("DEBUG: Flush after UserPlan creation succeeded");

                // Step 6: Create student + StudentSessionInstituteGroupMapping
                // batchStatus = ACTIVE for offline (immediate access), INVITED for online
                // (access granted post-payment)
                List<InstituteStudentDetails> instituteStudentDetails = new ArrayList<>();
                instituteStudentDetails.add(InstituteStudentDetails.builder()
                                .instituteId(request.getInstituteId())
                                .packageSessionId(request.getPackageSessionId())
                                .enrollmentStatus(batchStatus)
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
                        // Validate CPO is valid for this package session
                        validateCpoForPackageSession(request.getPackageSessionId(), request.getCpoId());

                        studentFeePaymentIds = studentFeePaymentGenerationService.generateFeeBills(
                                        userPlan.getId(),
                                        request.getCpoId(),
                                        createdUser.getId(),
                                        request.getInstituteId());
                        log.info("Generated {} fee bills from CPO: {}", studentFeePaymentIds.size(),
                                        request.getCpoId());
                }

                // Step 8: Handle payment (if provided)
                PaymentResponseDTO paymentResponseDTO = null;
                if (request.getSchoolPayment() != null) {
                        paymentResponseDTO = handlePayment(request.getSchoolPayment(), createdUser, userPlan,
                                        enrollInvite,
                                        request.getInstituteId());
                }

                // Build response
                return SchoolEnrollResponseDTO.builder()
                                .userId(createdUser.getId())
                                .userPlanId(userPlan.getId())
                                .studentFeePaymentIds(studentFeePaymentIds)
                                .message(isOnline ? "Student enrolled. Proceed to payment."
                                                : "Student enrolled successfully")
                                .paymentResponse(paymentResponseDTO)
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

        /**
         * Validates that the given CPO is valid for the specified package session
         * AND that it is in ACTIVE status (not pending approval).
         *
         * @param packageSessionId The package session (class) ID
         * @param cpoId            The ComplexPaymentOption (fee structure) ID
         * @throws VacademyException if CPO is not valid for this package session or not
         *                           yet approved
         */
        private void validateCpoForPackageSession(String packageSessionId, String cpoId) {
                List<String> validCpoIds = packageSessionLearnerInvitationRepository
                                .findDistinctCpoIdsByPackageSessionId(packageSessionId);

                if (!validCpoIds.contains(cpoId)) {
                        log.error("Invalid CPO validation failed. CPO: {} not found in valid options {} for package session: {}",
                                        cpoId, validCpoIds, packageSessionId);
                        throw new VacademyException(
                                        String.format("Invalid fee structure (CPO: %s) for the selected class. "
                                                        + "Please select a valid fee structure from the available options.",
                                                        cpoId));
                }

                // Guard: CPO must be ACTIVE (not pending approval) before it can be used for
                // enrollment
                ComplexPaymentOption cpo = complexPaymentOptionRepository
                                .findById(cpoId)
                                .orElseThrow(() -> new VacademyException("Fee structure not found: " + cpoId));

                if ("PENDING_APPROVAL".equalsIgnoreCase(cpo.getStatus())) {
                        log.error("Enrollment blocked: CPO {} is still pending approval.", cpoId);
                        throw new VacademyException(
                                        "This fee structure is pending approval and cannot be used for enrollment. "
                                                        + "Please ask an admin to approve it first.");
                }

                log.info("CPO validation successful. CPO: {} is ACTIVE and valid for package session: {}", cpoId,
                                packageSessionId);
        }

        private PaymentResponseDTO handlePayment(SchoolPaymentDTO payment, UserDTO user, UserPlan userPlan,
                        EnrollInvite enrollInvite, String instituteId) {
                if ("OFFLINE".equalsIgnoreCase(payment.getPaymentMode())) {
                        handleOfflinePayment(payment, user, userPlan, enrollInvite);
                        return null; // Offline has no checkout response
                } else if ("ONLINE".equalsIgnoreCase(payment.getPaymentMode())) {
                        return handleOnlinePayment(payment, user, userPlan, enrollInvite, instituteId);
                } else {
                        throw new VacademyException("Invalid payment mode: " + payment.getPaymentMode()
                                        + ". Supported modes: OFFLINE, ONLINE");
                }
        }

        /**
         * Handles online payment via Razorpay.
         * Creates a Razorpay order and returns checkout details to the frontend.
         * Fee bills remain PENDING — allocation happens in the webhook after parent
         * pays.
         *
         * @param payment      the payment DTO from the request
         * @param user         the enrolled student user
         * @param userPlan     the UserPlan (status = PAYMENT_PENDING at this point)
         * @param enrollInvite the enroll invite (carries vendor, vendorId, currency)
         * @param instituteId  the institute ID
         * @return PaymentResponseDTO with razorpayOrderId, razorpayKey for frontend
         *         checkout
         */
        private PaymentResponseDTO handleOnlinePayment(SchoolPaymentDTO payment, UserDTO user, UserPlan userPlan,
                        EnrollInvite enrollInvite, String instituteId) {
                if (payment.getAmount() == null || payment.getAmount().compareTo(java.math.BigDecimal.ZERO) <= 0) {
                        throw new VacademyException("Online payment amount must be greater than zero");
                }

                // Build PaymentInitiationRequestDTO — marks payment_type as SCHOOL
                // so the Razorpay webhook routes to handleSchoolPayment() instead of regular
                // flow
                PaymentInitiationRequestDTO paymentRequest = new PaymentInitiationRequestDTO();
                paymentRequest.setAmount(payment.getAmount().doubleValue());
                paymentRequest.setCurrency(enrollInvite.getCurrency() != null ? enrollInvite.getCurrency() : "INR");
                paymentRequest.setEmail(user.getEmail());
                paymentRequest.setInstituteId(instituteId);
                paymentRequest.setPaymentType(PaymentType.SCHOOL); // ← key routing flag for webhook

                // Wrap into the DTO that PaymentService.handlePayment() accepts
                LearnerPackageSessionsEnrollDTO enrollDTO = new LearnerPackageSessionsEnrollDTO();
                enrollDTO.setPaymentInitiationRequest(paymentRequest);

                // Delegates to PaymentService which:
                // 1. Creates PaymentLog (INITIATED)
                // 2. Creates/gets Razorpay customer
                // 3. Creates Razorpay order with payment_type=SCHOOL in notes
                // 4. Returns razorpayOrderId + razorpayKey for frontend
                PaymentResponseDTO response = paymentService.handlePayment(user, enrollDTO, instituteId, enrollInvite,
                                userPlan);

                log.info("Online school payment order created for UserPlan: {}, PaymentLog: {}",
                                userPlan.getId(), response.getOrderId());

                return response;
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

                // Update payment log with SUCCESS status (no post-payment invoice logic —
                // school receipt is handled separately)
                paymentLogService.updatePaymentLogOnly(
                                paymentLogId,
                                PaymentLogStatusEnum.SUCCESS.name(),
                                PaymentStatusEnum.PAID.name(),
                                JsonUtil.toJson(paymentSpecificData));

                log.info("Created payment log {} for offline payment of {} {}", paymentLogId, payment.getAmount(),
                                currency);

                // Allocate payment to StudentFeePayment bills (FIFO)
                feeLedgerAllocationService.allocatePayment(
                                paymentLogId,
                                payment.getAmount(),
                                userPlan.getId());

                log.info("Offline payment of {} allocated to fee bills for UserPlan: {}", payment.getAmount(),
                                userPlan.getId());

                // Generate and send school fee receipt (PDF email) — failure won't affect
                // enrollment
                try {
                        String txnId = manual != null && manual.getTransactionId() != null ? manual.getTransactionId()
                                        : "N/A";
                        schoolFeeReceiptService.generateAndSendReceipt(
                                        user.getId(), userPlan.getId(), paymentLogId,
                                        enrollInvite.getInstituteId(),
                                        payment.getAmount(), txnId, "OFFLINE");
                } catch (Exception e) {
                        log.error("Failed to generate school fee receipt for UserPlan: {}. Enrollment succeeded.",
                                        userPlan.getId(), e);
                }
        }
}
