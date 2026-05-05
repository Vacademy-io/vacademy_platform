package vacademy.io.admin_core_service.features.user_subscription.enums;

public enum PaymentOptionType {
    SUBSCRIPTION,
    ONE_TIME,
    FREE,
    DONATION,
    /**
     * Mirror PaymentOption that represents a ComplexPaymentOption (multi-installment fee structure).
     * The actual CPO is reachable via PaymentOption.complexPaymentOptionId. Hidden by default
     * from the generic /payment-options listing (managed via /fee-management/cpo/* instead).
     */
    CPO;

    /**
     * Parses the given string to a PaymentOptionType.
     *
     * @param paymentOptionType input string
     * @return corresponding PaymentOptionType enum
     * @throws IllegalArgumentException if input is null, blank, or invalid
     */
    public static PaymentOptionType fromString(String paymentOptionType) {
        if (paymentOptionType == null || paymentOptionType.isBlank()) {
            throw new IllegalArgumentException("PaymentOptionType cannot be null or blank.");
        }
        try {
            return PaymentOptionType.valueOf(paymentOptionType.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid PaymentOptionType: " + paymentOptionType, e);
        }
    }
}
