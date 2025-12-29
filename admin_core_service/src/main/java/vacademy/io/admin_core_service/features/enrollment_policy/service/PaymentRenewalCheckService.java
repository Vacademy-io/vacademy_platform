package vacademy.io.admin_core_service.features.enrollment_policy.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.OnExpiryPolicyDTO;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionType;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentOptionRepository;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;

/**
 * Service to check if payment renewal should be attempted for a UserPlan.
 * Determines if payment should be processed based on:
 * 1. PaymentOption type (only SUBSCRIPTION can be renewed)
 * 2. Enrollment policy auto-renewal setting
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentRenewalCheckService {

    private final PaymentOptionRepository paymentOptionRepository;

    /**
     * Checks if payment renewal should be attempted for the given UserPlan.
     * 
     * Payment will be attempted ONLY if:
     * 1. PaymentOption type is SUBSCRIPTION
     * 2. Enrollment policy has enableAutoRenewal = true (or not specified, defaults
     * to true)
     * 3. Vendor is NOT MANUAL (MANUAL vendors require manual payment processing)
     * 
     * For FREE, DONATION, ONE_TIME: Payment is never attempted
     * For MANUAL vendor: Payment is never attempted (requires manual processing)
     * 
     * @param userPlan         The UserPlan to check
     * @param enrollmentPolicy The enrollment policy settings
     * @return true if payment should be attempted, false otherwise
     */
    public boolean shouldAttemptPayment(UserPlan userPlan, EnrollmentPolicySettingsDTO enrollmentPolicy) {
        if (userPlan == null) {
            log.debug("UserPlan is null, skipping payment attempt");
            return false;
        }

        // Check vendor - if MANUAL, do not attempt automatic payment
        String vendor = getVendor(userPlan);
        if (StringUtils.hasText(vendor) && "MANUAL".equalsIgnoreCase(vendor)) {
            log.info(
                    "Vendor is MANUAL for UserPlan: {}, skipping automatic payment attempt (requires manual processing)",
                    userPlan.getId());
            return false;
        }

        // Get PaymentOption type
        PaymentOption paymentOption = getPaymentOption(userPlan);
        if (paymentOption == null) {
            log.warn("PaymentOption not found for UserPlan: {}, skipping payment attempt", userPlan.getId());
            return false;
        }

        String paymentOptionType = paymentOption.getType();
        if (!StringUtils.hasText(paymentOptionType)) {
            log.warn("PaymentOption type is empty for UserPlan: {}, skipping payment attempt", userPlan.getId());
            return false;
        }

        // Only SUBSCRIPTION type can be renewed
        if (!PaymentOptionType.SUBSCRIPTION.name().equalsIgnoreCase(paymentOptionType)) {
            log.debug("PaymentOption type is {} (not SUBSCRIPTION) for UserPlan: {}, skipping payment attempt",
                    paymentOptionType, userPlan.getId());
            return false;
        }

        // Check enrollment policy auto-renewal setting
        boolean autoRenewalEnabled = isAutoRenewalEnabled(enrollmentPolicy);
        if (!autoRenewalEnabled) {
            log.info("Auto-renewal is disabled in enrollment policy for UserPlan: {}, skipping payment attempt",
                    userPlan.getId());
            return false;
        }

        log.debug(
                "Payment renewal should be attempted for UserPlan: {} (SUBSCRIPTION with auto-renewal enabled, vendor: {})",
                userPlan.getId(), vendor);
        return true;
    }

    /**
     * Gets the PaymentOption for a UserPlan.
     * Tries to get from lazy-loaded relationship first, then falls back to
     * repository lookup.
     */
    private PaymentOption getPaymentOption(UserPlan userPlan) {
        // Try to get from lazy-loaded relationship
        PaymentOption paymentOption = userPlan.getPaymentOption();
        if (paymentOption != null) {
            return paymentOption;
        }

        // Fallback to repository lookup
        String paymentOptionId = userPlan.getPaymentOptionId();
        if (StringUtils.hasText(paymentOptionId)) {
            return paymentOptionRepository.findById(paymentOptionId).orElse(null);
        }

        return null;
    }

    /**
     * Checks if auto-renewal is enabled in the enrollment policy.
     * Defaults to true if not specified (backward compatibility).
     */
    private boolean isAutoRenewalEnabled(EnrollmentPolicySettingsDTO enrollmentPolicy) {
        if (enrollmentPolicy == null || enrollmentPolicy.getOnExpiry() == null) {
            // Default to true if policy not configured
            log.debug("Enrollment policy or onExpiry not configured, defaulting auto-renewal to true");
            return true;
        }

        OnExpiryPolicyDTO onExpiry = enrollmentPolicy.getOnExpiry();
        Boolean enableAutoRenewal = onExpiry.getEnableAutoRenewal();

        // Default to true if not specified (backward compatibility)
        if (enableAutoRenewal == null) {
            log.debug("enableAutoRenewal not specified in policy, defaulting to true");
            return true;
        }

        return enableAutoRenewal;
    }

    /**
     * Gets the PaymentOption type for a UserPlan.
     * 
     * @param userPlan The UserPlan
     * @return PaymentOptionType enum value, or null if not found
     */
    public PaymentOptionType getPaymentOptionType(UserPlan userPlan) {
        if (userPlan == null) {
            return null;
        }

        PaymentOption paymentOption = getPaymentOption(userPlan);
        if (paymentOption == null || !StringUtils.hasText(paymentOption.getType())) {
            return null;
        }

        try {
            return PaymentOptionType.fromString(paymentOption.getType());
        } catch (IllegalArgumentException e) {
            log.warn("Invalid PaymentOption type: {} for UserPlan: {}", paymentOption.getType(), userPlan.getId());
            return null;
        }
    }

    /**
     * Gets vendor from UserPlan's EnrollInvite or jsonPaymentDetails.
     * 
     * @param userPlan The UserPlan
     * @return Vendor string, or null if not found
     */
    private String getVendor(UserPlan userPlan) {
        // First try from EnrollInvite
        EnrollInvite enrollInvite = userPlan.getEnrollInvite();
        if (enrollInvite != null && StringUtils.hasText(enrollInvite.getVendor())) {
            return enrollInvite.getVendor();
        }

        // Try to parse from jsonPaymentDetails
        if (StringUtils.hasText(userPlan.getJsonPaymentDetails())) {
            try {
                PaymentInitiationRequestDTO paymentRequest = JsonUtil.fromJson(
                        userPlan.getJsonPaymentDetails(),
                        PaymentInitiationRequestDTO.class);

                if (paymentRequest != null && StringUtils.hasText(paymentRequest.getVendor())) {
                    return paymentRequest.getVendor().toUpperCase();
                }
            } catch (Exception e) {
                log.debug("Could not extract vendor from jsonPaymentDetails for UserPlan: {}", userPlan.getId(), e);
            }
        }

        return null;
    }
}

