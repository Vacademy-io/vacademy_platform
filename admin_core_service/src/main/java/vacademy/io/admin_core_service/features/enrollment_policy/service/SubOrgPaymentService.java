package vacademy.io.admin_core_service.features.enrollment_policy.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.payments.service.PaymentService;
import vacademy.io.admin_core_service.features.enrollment_policy.processor.EnrolmentContext;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

/**
 * Service for processing payments for SUB_ORG source UserPlans on expiry.
 * Handles payment processing, success/failure scenarios, and notifications.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubOrgPaymentService {

    private final PaymentService paymentService;

    /**
     * Processes payment for SUB_ORG UserPlan on expiry.
     * Uses Institute ID (not SubOrg ID) for payment processing.
     * Uses ROOT_ADMIN from EnrolmentContext (already fetched, no redundant API
     * call).
     * 
     * @param context  EnrolmentContext containing ROOT_ADMIN UserDTO
     * @param userPlan UserPlan with source = SUB_ORG
     * @return PaymentResponseDTO with payment result
     * @throws VacademyException if payment processing fails
     */
    @Transactional
    public PaymentResponseDTO processSubOrgPaymentOnExpiry(EnrolmentContext context, UserPlan userPlan) {
        log.info("Processing SUB_ORG payment on expiry for UserPlan: {}", userPlan.getId());

        // 1. Get payment details from jsonPaymentDetails
        PaymentInitiationRequestDTO paymentRequest = extractPaymentRequest(userPlan);

        // 2. Get vendor from jsonPaymentDetails or enrollInvite
        String vendor = getVendor(userPlan, paymentRequest);
        String vendorId = getVendorId(userPlan, paymentRequest);
        String currency = getCurrency(userPlan, paymentRequest);

        // 3. Get amount from PaymentPlan
        double amount = getPaymentAmount(userPlan);

        // 4. Get Institute ID from enrollInvite (NOT SubOrg ID)
        String instituteId = userPlan.getEnrollInvite().getInstituteId();
        if (!StringUtils.hasText(instituteId)) {
            throw new VacademyException("Institute ID not found in enroll invite");
        }

        // 5. Update payment request with correct values
        paymentRequest.setVendor(vendor);
        paymentRequest.setVendorId(vendorId);
        paymentRequest.setCurrency(currency);
        paymentRequest.setAmount(amount);
        paymentRequest.setInstituteId(instituteId); // Use Institute ID, not SubOrg ID

        // 6. Get ROOT_ADMIN user from context (already fetched, no redundant API call)
        UserDTO rootAdmin = context.getUser();
        if (rootAdmin == null) {
            throw new VacademyException("ROOT_ADMIN user not found in context for payment processing");
        }

        if (StringUtils.hasText(rootAdmin.getEmail())) {
            paymentRequest.setEmail(rootAdmin.getEmail());
            log.info("Using ROOT_ADMIN email: {} for payment processing", rootAdmin.getEmail());
        } else {
            log.warn("ROOT_ADMIN email not available, but proceeding with payment");
        }

        // 7. Process payment using Institute ID with UserDTO (ROOT_ADMIN)
        try {
            PaymentResponseDTO response = paymentService.handlePaymentWithUser(
                    paymentRequest,
                    instituteId,
                    rootAdmin,
                    userPlan);
            log.info("Payment processed successfully for UserPlan: {}, Institute: {}", userPlan.getId(), instituteId);
            return response;
        } catch (Exception e) {
            log.error("Payment processing failed for UserPlan: {}, Institute: {}", userPlan.getId(), instituteId, e);
            throw new VacademyException("Payment processing failed: " + e.getMessage());
        }
    }

    /**
     * Extracts PaymentInitiationRequestDTO from userPlan.jsonPaymentDetails.
     */
    private PaymentInitiationRequestDTO extractPaymentRequest(UserPlan userPlan) {
        if (!StringUtils.hasText(userPlan.getJsonPaymentDetails())) {
            throw new VacademyException("Payment details not found in UserPlan");
        }

        try {
            PaymentInitiationRequestDTO request = JsonUtil.fromJson(
                    userPlan.getJsonPaymentDetails(),
                    PaymentInitiationRequestDTO.class);

            if (request == null) {
                throw new VacademyException("Failed to parse payment details");
            }

            return request;
        } catch (Exception e) {
            log.error("Error parsing payment details from UserPlan: {}", userPlan.getId(), e);
            throw new VacademyException("Invalid payment details format: " + e.getMessage());
        }
    }

    /**
     * Gets vendor from jsonPaymentDetails or enrollInvite.
     */
    private String getVendor(UserPlan userPlan, PaymentInitiationRequestDTO paymentRequest) {
        // First try from payment request
        if (StringUtils.hasText(paymentRequest.getVendor())) {
            return paymentRequest.getVendor().toUpperCase();
        }

        // Fallback to enrollInvite
        EnrollInvite enrollInvite = userPlan.getEnrollInvite();
        if (enrollInvite != null && StringUtils.hasText(enrollInvite.getVendor())) {
            return enrollInvite.getVendor();
        }

        throw new VacademyException("Vendor not found in payment details or enroll invite");
    }

    /**
     * Gets vendor ID from jsonPaymentDetails or enrollInvite.
     */
    private String getVendorId(UserPlan userPlan, PaymentInitiationRequestDTO paymentRequest) {
        // First try from payment request
        if (StringUtils.hasText(paymentRequest.getVendorId())) {
            return paymentRequest.getVendorId();
        }

        // Fallback to enrollInvite
        EnrollInvite enrollInvite = userPlan.getEnrollInvite();
        if (enrollInvite != null && StringUtils.hasText(enrollInvite.getVendorId())) {
            return enrollInvite.getVendorId();
        }

        return null; // Vendor ID is optional
    }

    /**
     * Gets currency from jsonPaymentDetails or enrollInvite.
     */
    private String getCurrency(UserPlan userPlan, PaymentInitiationRequestDTO paymentRequest) {
        // First try from payment request
        if (StringUtils.hasText(paymentRequest.getCurrency())) {
            return paymentRequest.getCurrency();
        }

        // Fallback to enrollInvite
        EnrollInvite enrollInvite = userPlan.getEnrollInvite();
        if (enrollInvite != null && StringUtils.hasText(enrollInvite.getCurrency())) {
            return enrollInvite.getCurrency();
        }

        return "USD"; // Default currency
    }

    /**
     * Gets payment amount from PaymentPlan.actualPrice.
     */
    private double getPaymentAmount(UserPlan userPlan) {
        PaymentPlan paymentPlan = userPlan.getPaymentPlan();
        if (paymentPlan == null) {
            throw new VacademyException("PaymentPlan not found for UserPlan");
        }

        double amount = paymentPlan.getActualPrice();
        if (amount <= 0) {
            throw new VacademyException("Invalid payment amount: " + amount);
        }

        log.debug("Using payment amount: {} from PaymentPlan: {}", amount, paymentPlan.getId());
        return amount;
    }

    /**
     * Checks if payment was successful.
     */
    public boolean isPaymentSuccessful(PaymentResponseDTO response) {
        if (response == null || response.getResponseData() == null) {
            return false;
        }

        Object paymentStatus = response.getResponseData().get("paymentStatus");
        if (paymentStatus == null) {
            return false;
        }

        String status = paymentStatus.toString().toUpperCase();
        return "PAID".equals(status) || "SUCCESS".equals(status) || "CAPTURED".equals(status);
    }
}
