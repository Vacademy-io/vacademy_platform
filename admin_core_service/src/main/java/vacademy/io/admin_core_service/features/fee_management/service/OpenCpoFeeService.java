package vacademy.io.admin_core_service.features.fee_management.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.fee_management.dto.ComplexPaymentOptionDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.OpenCpoPayInstallmentsRequestDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeePaymentDTO;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.admin_core_service.features.fee_management.service.FeeManagementService;
import vacademy.io.admin_core_service.features.payments.service.PaymentService;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentOptionRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.enums.PaymentType;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Backs the open (no-JWT) CPO installment endpoints:
 * <ul>
 *   <li>{@code GET  /admin-core-service/open/v1/fee/cpo-dues}</li>
 *   <li>{@code POST /admin-core-service/open/v1/fee/cpo-pay-installments}</li>
 *   <li>{@code GET  /admin-core-service/open/v1/fee/cpo-schedule}</li>
 * </ul>
 *
 * <p>Because there is no JWT, caller identity is established by the
 * {@code userId} + {@code userPlanId} pair. Every service method validates
 * that all requested {@link StudentFeePayment} rows genuinely belong to the
 * supplied userId/userPlanId combination before proceeding.</p>
 */
@Service
@Slf4j
public class OpenCpoFeeService {

    @Autowired
    private StudentFeePaymentRepository studentFeePaymentRepository;

    @Autowired
    private UserPlanRepository userPlanRepository;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private CpoDuesCalculator cpoDuesCalculator;

    @Autowired
    private FeeTrackingService feeTrackingService;

    @Autowired
    private FeeManagementService feeManagementService;

    @Autowired
    private PaymentOptionRepository paymentOptionRepository;

    /**
     * Returns the full installment schedule for a given UserPlan, validating that
     * the plan belongs to {@code userId}.
     *
     * @param userId     the learner's user ID (supplied by the client, not a JWT)
     * @param userPlanId the UserPlan to fetch installments for
     * @return list of all StudentFeePaymentDTOs for the plan
     */
    public List<StudentFeePaymentDTO> getCpoDues(String userId, String userPlanId) {
        if (userId == null || userId.isBlank()) {
            throw new VacademyException("userId is required");
        }
        if (userPlanId == null || userPlanId.isBlank()) {
            throw new VacademyException("userPlanId is required");
        }
        return feeTrackingService.getCpoDuesByUserPlan(userId, userPlanId);
    }

    /**
     * Initiates a payment for one or more pending StudentFeePayment rows belonging
     * to the given userId/userPlanId. Mirrors
     * {@link LearnerInstallmentPaymentService#payInstallments} but uses the
     * request-supplied {@code userId} and {@code userPlanId} instead of a JWT claim.
     *
     * @param request the pay-installments request
     * @return PaymentResponseDTO from the configured gateway
     */
    public PaymentResponseDTO payInstallments(OpenCpoPayInstallmentsRequestDTO request) {
        if (request == null) {
            throw new VacademyException("request is required");
        }
        if (request.getUserId() == null || request.getUserId().isBlank()) {
            throw new VacademyException("userId is required");
        }
        if (request.getUserPlanId() == null || request.getUserPlanId().isBlank()) {
            throw new VacademyException("userPlanId is required");
        }
        if (request.getStudentFeePaymentIds() == null || request.getStudentFeePaymentIds().isEmpty()) {
            throw new VacademyException("studentFeePaymentIds is required");
        }
        if (request.getPaymentInitiationRequest() == null) {
            throw new VacademyException("paymentInitiationRequest is required");
        }

        String callerUserId = request.getUserId();
        String callerUserPlanId = request.getUserPlanId();

        List<StudentFeePayment> rows = studentFeePaymentRepository.findAllById(request.getStudentFeePaymentIds());
        if (rows.size() != request.getStudentFeePaymentIds().size()) {
            throw new VacademyException("One or more StudentFeePayment ids not found");
        }

        // Ownership validation: every SFP must belong to the caller's userId AND userPlanId.
        // Partition into still-pending vs already-settled (PAID/WAIVED) rather than hard-failing
        // on the first settled row — see the idempotency guard below for why.
        Set<String> userPlanIds = new HashSet<>();
        List<String> pendingSfpIds = new ArrayList<>();
        for (StudentFeePayment sfp : rows) {
            if (!callerUserId.equals(sfp.getUserId())) {
                throw new VacademyException(
                        "StudentFeePayment " + sfp.getId() + " does not belong to user " + callerUserId);
            }
            if (!callerUserPlanId.equals(sfp.getUserPlanId())) {
                throw new VacademyException(
                        "StudentFeePayment " + sfp.getId() + " does not belong to userPlan " + callerUserPlanId);
            }
            userPlanIds.add(sfp.getUserPlanId());
            if (!("PAID".equalsIgnoreCase(sfp.getStatus()) || "WAIVED".equalsIgnoreCase(sfp.getStatus()))) {
                pendingSfpIds.add(sfp.getId());
            }
        }
        if (userPlanIds.size() > 1) {
            throw new VacademyException(
                    "All studentFeePaymentIds must belong to the same UserPlan; got " + userPlanIds);
        }

        // Idempotency / webhook-race guard.
        // Settlement for this flow happens out-of-band in the gateway success webhook
        // (RazorpayWebHookService order.paid/payment.captured -> FeeLedgerAllocationService
        // .allocatePayment), which marks these StudentFeePayment rows PAID. The learner
        // dashboard fires a *second* "confirm" call to this endpoint right after checkout.
        // When that confirm call loses the race to the webhook, every requested installment
        // is already PAID. Previously we threw "StudentFeePayment <id> is already PAID" ->
        // HTTP 510, so a *successful* payment surfaced to the learner as an error. Treat a
        // fully-settled set as an idempotent success instead.
        boolean isRazorpayConfirmCall = request.getPaymentInitiationRequest().getRazorpayRequest() != null
                && StringUtils.hasText(
                        request.getPaymentInitiationRequest().getRazorpayRequest().getRazorpayPaymentId());

        if (pendingSfpIds.isEmpty()) {
            log.info("Open CPO payInstallments: all {} installment(s) already settled for userPlan={} "
                    + "(webhook won the race or duplicate confirm) — returning idempotent PAID",
                    rows.size(), callerUserPlanId);
            return buildStatusResponse("PAID", "Installments already settled");
        }

        // A post-checkout Razorpay confirm call (carries a razorpay_payment_id) where some
        // installments are still pending means the webhook simply hasn't landed yet. Do NOT
        // re-initiate payment here: RazorpayPaymentManager.initiatePayment always creates a
        // fresh order, which would leave a phantom unpaid order on every payment. Report
        // PROCESSING and let the webhook finish; the dashboard's PaymentPendingStep polls
        // the original order's payment-log status and advances to success on its own.
        if (isRazorpayConfirmCall) {
            log.info("Open CPO payInstallments: Razorpay confirm call for userPlan={} but {} of {} "
                    + "installment(s) still pending — webhook in flight, not initiating a new order",
                    callerUserPlanId, pendingSfpIds.size(), rows.size());
            return buildStatusResponse("PAYMENT_PENDING", "Payment is being processed");
        }

        UserPlan userPlan = userPlanRepository.findById(callerUserPlanId)
                .orElseThrow(() -> new VacademyException("UserPlan not found: " + callerUserPlanId));

        // Determine the amount to charge (only the still-pending installments)
        BigDecimal outstanding;
        if (request.getCustomAmount() != null && request.getCustomAmount() > 0) {
            outstanding = BigDecimal.valueOf(request.getCustomAmount());
            log.info("Using caller-supplied customAmount={} for userPlan={}", outstanding, callerUserPlanId);
        } else {
            outstanding = cpoDuesCalculator.computeOutstandingForSfpIds(pendingSfpIds);
        }

        if (outstanding.signum() <= 0) {
            throw new VacademyException("All selected installments are already settled");
        }

        EnrollInvite enrollInvite = userPlan.getEnrollInvite();
        if (enrollInvite == null) {
            throw new VacademyException(
                    "UserPlan " + callerUserPlanId + " has no EnrollInvite — cannot resolve payment vendor");
        }

        // Build the payment initiation request
        PaymentInitiationRequestDTO paymentRequest = request.getPaymentInitiationRequest();
        paymentRequest.setAmount(outstanding.doubleValue());
        paymentRequest.setPaymentType(PaymentType.SCHOOL);
        if (paymentRequest.getCurrency() == null) {
            paymentRequest.setCurrency(enrollInvite.getCurrency() != null ? enrollInvite.getCurrency() : "INR");
        }
        if (paymentRequest.getInstituteId() == null) {
            paymentRequest.setInstituteId(request.getInstituteId() != null
                    ? request.getInstituteId() : enrollInvite.getInstituteId());
        }
        if (paymentRequest.getVendor() == null && enrollInvite.getVendor() != null) {
            paymentRequest.setVendor(enrollInvite.getVendor());
        }
        if (paymentRequest.getVendorId() == null && enrollInvite.getVendorId() != null) {
            paymentRequest.setVendorId(enrollInvite.getVendorId());
        }

        UserDTO learnerStub = new UserDTO();
        learnerStub.setId(callerUserId);
        learnerStub.setEmail(paymentRequest.getEmail());
        if (request.getName() != null && !request.getName().isBlank()) {
            learnerStub.setFullName(request.getName());
        } else {
            // Razorpay/Stripe customer creation requires a non-empty name.
            // Fall back to email prefix so the payment can proceed.
            String fallbackName = paymentRequest.getEmail() != null
                    ? paymentRequest.getEmail().split("@")[0]
                    : "Learner";
            learnerStub.setFullName(fallbackName);
        }

        LearnerPackageSessionsEnrollDTO enrollDTO = new LearnerPackageSessionsEnrollDTO();
        enrollDTO.setPaymentInitiationRequest(paymentRequest);

        log.info("Open CPO installment payment: userPlan={}, sfpIds={}, amount={}",
                callerUserPlanId, request.getStudentFeePaymentIds(), outstanding);

        return paymentService.handlePayment(
                learnerStub,
                enrollDTO,
                paymentRequest.getInstituteId(),
                enrollInvite,
                userPlan);
    }

    /**
     * Builds a minimal {@link PaymentResponseDTO} carrying just a payment status, used by the
     * idempotent / webhook-race short-circuits in {@link #payInstallments}. The learner
     * dashboard reads {@code response_data.paymentStatus} to decide between the success and
     * pending screens.
     *
     * @param paymentStatus e.g. {@code "PAID"} or {@code "PAYMENT_PENDING"}
     * @param message       human-readable note for logs/UX
     */
    private PaymentResponseDTO buildStatusResponse(String paymentStatus, String message) {
        PaymentResponseDTO response = new PaymentResponseDTO();
        Map<String, Object> responseData = new HashMap<>();
        responseData.put("paymentStatus", paymentStatus);
        response.setResponseData(responseData);
        response.setStatus(paymentStatus);
        response.setMessage(message);
        return response;
    }

    /**
     * Returns the full CPO installment schedule for a given PaymentOption.
     * Used by the learner BEFORE enrollment so they can preview and select
     * which installments they want to pay at enrollment time.
     *
     * @param paymentOptionId the PaymentOption ID from the invite/product-page mapping
     * @return full {@link ComplexPaymentOptionDTO} with all fee types and installments
     */
    public ComplexPaymentOptionDTO getCpoSchedule(String paymentOptionId) {
        if (paymentOptionId == null || paymentOptionId.isBlank()) {
            throw new VacademyException("paymentOptionId is required");
        }
        PaymentOption paymentOption = paymentOptionRepository.findById(paymentOptionId)
                .orElseThrow(() -> new VacademyException("PaymentOption not found: " + paymentOptionId));
        String cpoId = paymentOption.getComplexPaymentOptionId();
        if (cpoId == null || cpoId.isBlank()) {
            throw new VacademyException(
                    "PaymentOption " + paymentOptionId + " is not a CPO type or has no CPO linked");
        }
        return feeManagementService.getFullCpo(cpoId);
    }
}
