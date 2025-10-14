package vacademy.io.common.payment.enums;

public enum PaymentGateway {
    STRIPE,
    RAZORPAY,
    MANUAL,
    PAYPAL,EWAY;

    public static PaymentGateway fromString(String gatewayName) {
        if (gatewayName == null || gatewayName.isBlank()) {
            throw new IllegalArgumentException("Payment gateway name cannot be null or empty");
        }

        try {
            return PaymentGateway.valueOf(gatewayName.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unsupported payment gateway: " + gatewayName);
        }
    }
}
