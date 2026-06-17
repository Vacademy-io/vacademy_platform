package vacademy.io.admin_core_service.features.invoice.enums;

/**
 * Controls which email carries the generated invoice PDF after a successful payment.
 * Stored as {@code INVOICE_SETTING.invoicePdfPlacement} in the institute settings JSON.
 *
 * <ul>
 *   <li>{@link #INVOICE_EMAIL} (default) — PDF goes in the dedicated "Your Invoice" email
 *       (legacy behaviour); the payment-confirmation email is sent separately without a PDF.</li>
 *   <li>{@link #PAYMENT_CONFIRMATION_EMAIL} — PDF is attached to the payment-confirmation email
 *       and the separate invoice email is suppressed, so the learner receives a single mail.</li>
 * </ul>
 */
public enum InvoicePdfPlacement {
    INVOICE_EMAIL,
    PAYMENT_CONFIRMATION_EMAIL;

    /**
     * Lenient parser for the raw setting value. Unknown / null / blank values fall back to
     * {@link #INVOICE_EMAIL} so missing or mistyped settings preserve the legacy behaviour.
     */
    public static InvoicePdfPlacement fromSetting(Object raw) {
        if (raw == null) {
            return INVOICE_EMAIL;
        }
        try {
            return InvoicePdfPlacement.valueOf(raw.toString().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return INVOICE_EMAIL;
        }
    }
}
