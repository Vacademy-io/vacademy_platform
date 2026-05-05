package vacademy.io.admin_core_service.features.fee_management.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.fee_management.dto.PayInstallmentsRequestDTO;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.admin_core_service.features.payments.service.PaymentService;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.enums.PaymentType;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Backs {@code POST /admin-core-service/learner/v1/fee/pay-installments}.
 *
 * <p>The learner sends a list of {@code studentFeePaymentIds} they want to pay
 * online. We validate ownership, sum outstanding amounts, build a
 * PaymentInitiationRequestDTO with {@code paymentType=SCHOOL}, and route through
 * {@link PaymentService#handlePayment} — same path as the school admission
 * online flow and the unified strategy. On webhook success, the existing
 * {@code handleSchoolPayment} branch in Razorpay flips the SFP rows to PAID via
 * {@link FeeLedgerAllocationService} and generates the Invoice.
 */
@Service
@Slf4j
public class LearnerInstallmentPaymentService {

    @Autowired
    private StudentFeePaymentRepository studentFeePaymentRepository;

    @Autowired
    private UserPlanRepository userPlanRepository;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private CpoDuesCalculator cpoDuesCalculator;

    public PaymentResponseDTO payInstallments(String callerUserId, PayInstallmentsRequestDTO request) {
        if (request == null || request.getStudentFeePaymentIds() == null
                || request.getStudentFeePaymentIds().isEmpty()) {
            throw new VacademyException("studentFeePaymentIds is required");
        }
        if (request.getPaymentInitiationRequest() == null) {
            throw new VacademyException("paymentInitiationRequest is required");
        }

        List<StudentFeePayment> rows = studentFeePaymentRepository.findAllById(request.getStudentFeePaymentIds());
        if (rows.size() != request.getStudentFeePaymentIds().size()) {
            throw new VacademyException("One or more StudentFeePayment ids not found");
        }

        // Ownership + UserPlan consistency: every row must belong to the caller and to
        // the same UserPlan (so allocation lands inside one ledger). If there are
        // multiple UserPlans, the learner must call this endpoint once per UserPlan.
        Set<String> userPlanIds = new HashSet<>();
        for (StudentFeePayment sfp : rows) {
            if (!callerUserId.equals(sfp.getUserId())) {
                throw new VacademyException(
                        "StudentFeePayment " + sfp.getId() + " does not belong to the calling learner");
            }
            if ("PAID".equalsIgnoreCase(sfp.getStatus()) || "WAIVED".equalsIgnoreCase(sfp.getStatus())) {
                throw new VacademyException(
                        "StudentFeePayment " + sfp.getId() + " is already " + sfp.getStatus());
            }
            userPlanIds.add(sfp.getUserPlanId());
        }
        if (userPlanIds.size() > 1) {
            throw new VacademyException(
                    "All studentFeePaymentIds must belong to the same UserPlan; got " + userPlanIds);
        }

        String userPlanId = userPlanIds.iterator().next();
        UserPlan userPlan = userPlanRepository.findById(userPlanId)
                .orElseThrow(() -> new VacademyException("UserPlan not found: " + userPlanId));

        BigDecimal outstanding = cpoDuesCalculator.computeOutstandingForSfpIds(request.getStudentFeePaymentIds());
        if (outstanding.signum() <= 0) {
            throw new VacademyException("All selected installments are already settled");
        }

        EnrollInvite enrollInvite = userPlan.getEnrollInvite();
        if (enrollInvite == null) {
            throw new VacademyException(
                    "UserPlan " + userPlanId + " has no EnrollInvite — cannot resolve payment vendor");
        }

        // Build the initiation request — strategy convention.
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

        LearnerPackageSessionsEnrollDTO enrollDTO = new LearnerPackageSessionsEnrollDTO();
        enrollDTO.setPaymentInitiationRequest(paymentRequest);

        log.info("Initiating installment payment for userPlan={}, sfpIds={}, amount={}",
                userPlanId, request.getStudentFeePaymentIds(), outstanding);
        return paymentService.handlePayment(
                learnerStub,
                enrollDTO,
                paymentRequest.getInstituteId(),
                enrollInvite,
                userPlan);
    }
}
