package vacademy.io.common.payment.enums;

/**
 * How a payment was actually collected — the instrument/method, independent of the
 * gateway vendor ({@link PaymentGateway}). Stored as the enum name (String) on
 * payment_log.payment_mode.
 *
 * <p>Offline collection (admin-recorded): CASH, UPI, CARD, CHEQUE, BANK_TRANSFER.
 * Online gateways map their instrument here too: UPI, CARD, NET_BANKING, WALLET.</p>
 */
public enum PaymentMode {
    CASH,
    UPI,
    CARD,
    NET_BANKING,
    CHEQUE,
    BANK_TRANSFER,
    WALLET,
    OTHER;

    public static PaymentMode fromString(String modeName) {
        if (modeName == null || modeName.isBlank()) {
            throw new IllegalArgumentException("Payment mode name cannot be null or empty");
        }
        try {
            return PaymentMode.valueOf(modeName.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unsupported payment mode: " + modeName);
        }
    }

    /** Null-safe parse that returns null instead of throwing for blank/invalid values. */
    public static PaymentMode fromStringOrNull(String modeName) {
        if (modeName == null || modeName.isBlank()) {
            return null;
        }
        try {
            return PaymentMode.valueOf(modeName.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
