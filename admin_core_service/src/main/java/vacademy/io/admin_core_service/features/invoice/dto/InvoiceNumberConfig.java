package vacademy.io.admin_core_service.features.invoice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.invoice.enums.InvoiceSeqScope;

import java.util.Map;

/**
 * Typed view of {@code INVOICE_SETTING.numbering} — the admin-configured invoice
 * number strategy.
 *
 * <p>Parsing is deliberately lenient (same spirit as
 * {@link vacademy.io.admin_core_service.features.invoice.enums.InvoicePdfPlacement#fromSetting}):
 * every field falls back to a legacy default, and {@link #legacyDefault()} reproduces the
 * old hardcoded {@code INV-yyyyMMdd-0001} exactly. That means the thousands of institutes
 * with no {@code numbering} block keep their current numbering with no migration and no
 * behaviour change until someone edits the setting.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceNumberConfig {

    /** Max rendered length — {@code invoice.invoice_number} is VARCHAR(100). */
    public static final int MAX_LENGTH = 100;

    public static final String LEGACY_FORMAT = "INV-{{YYYYMMDD}}-{{seq}}";

    /** Token format string, e.g. {@code "{{institute_code}}/{{FY}}/{{seq}}"}. */
    private String format;

    /** Zero-padding width for {@code {{seq}}} when the token carries no {@code :N} modifier. */
    private int seqPadding;

    /** When the counter rolls over. */
    private InvoiceSeqScope seqScope;

    /** Admin-set short code for {@code {{institute_code}}}; blank means "derive from name". */
    private String instituteCode;

    /**
     * First month of the financial year, 1-12, for {@code {{FY}}} / {@code {{FYY}}} /
     * {@code {{FQ}}}. Defaults to 4 (April — India, UK). AU institutes use 7, calendar-year
     * regimes use 1.
     */
    private int fyStartMonth;

    /** Uppercase / strip accents / truncate the free-text tokens (name, course, …). */
    private boolean sanitizeTokens;

    /**
     * Floor for the sequence: the next number is never lower than this, so an institute
     * migrating from another accounting system can continue its existing series. Acts as a
     * floor rather than a hard set, which is what makes it safe — lowering it below what has
     * already been issued is simply ignored instead of reusing numbers. 0/null means "no floor".
     */
    private long startFrom;

    /** True when this format distinguishes document kinds itself (invoice vs receipt). */
    public boolean usesDocType() {
        return format != null && format.contains("{{doc_type}}");
    }

    /**
     * A copy of this config with a different format, keeping every other setting. Used by the
     * fee-receipt services to keep their {@code RCT-} / {@code APP-FEE-} prefix when the
     * institute's format has no {@code {{doc_type}}} token to carry it.
     */
    public InvoiceNumberConfig withFormat(String replacementFormat) {
        return InvoiceNumberConfig.builder()
                .format(replacementFormat)
                .seqPadding(seqPadding)
                .seqScope(seqScope)
                .instituteCode(instituteCode)
                .fyStartMonth(fyStartMonth)
                .sanitizeTokens(sanitizeTokens)
                .startFrom(startFrom)
                .build();
    }

    /** Exactly the behaviour of the old hardcoded generator. */
    public static InvoiceNumberConfig legacyDefault() {
        return InvoiceNumberConfig.builder()
                .format(LEGACY_FORMAT)
                .seqPadding(4)
                .seqScope(InvoiceSeqScope.DAILY)
                .instituteCode("")
                .fyStartMonth(4)
                .sanitizeTokens(true)
                .startFrom(0)
                .build();
    }

    /**
     * Read the {@code numbering} object out of an already-loaded {@code INVOICE_SETTING}
     * data map. Any missing, null or unparseable field falls back to the legacy default
     * rather than throwing — a malformed setting must never stop an invoice being issued.
     */
    @SuppressWarnings("unchecked")
    public static InvoiceNumberConfig fromInvoiceSettings(Map<String, Object> invoiceSettings) {
        InvoiceNumberConfig fallback = legacyDefault();
        if (invoiceSettings == null) {
            return fallback;
        }
        Object raw = invoiceSettings.get("numbering");
        if (!(raw instanceof Map)) {
            return fallback;
        }
        Map<String, Object> numbering = (Map<String, Object>) raw;

        String format = asText(numbering.get("format"), fallback.getFormat());
        int padding = clamp(asInt(numbering.get("seqPadding"), fallback.getSeqPadding()), 1, 12);
        int fyStart = clamp(asInt(numbering.get("fyStartMonth"), fallback.getFyStartMonth()), 1, 12);

        return InvoiceNumberConfig.builder()
                .format(format)
                .seqPadding(padding)
                .seqScope(InvoiceSeqScope.fromSetting(numbering.get("seqScope")))
                .instituteCode(asText(numbering.get("instituteCode"), ""))
                .fyStartMonth(fyStart)
                .sanitizeTokens(asBool(numbering.get("sanitizeTokens"), true))
                .startFrom(Math.max(0, asLong(numbering.get("startFrom"), 0)))
                .build();
    }

    private static String asText(Object value, String fallback) {
        if (value == null) return fallback;
        String s = value.toString().trim();
        return s.isEmpty() ? fallback : s;
    }

    private static int asInt(Object value, int fallback) {
        if (value instanceof Number n) return n.intValue();
        if (value == null) return fallback;
        try {
            return Integer.parseInt(value.toString().trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static long asLong(Object value, long fallback) {
        if (value instanceof Number n) return n.longValue();
        if (value == null) return fallback;
        try {
            return Long.parseLong(value.toString().trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static boolean asBool(Object value, boolean fallback) {
        if (value instanceof Boolean b) return b;
        if (value == null) return fallback;
        String s = value.toString().trim();
        if ("true".equalsIgnoreCase(s)) return true;
        if ("false".equalsIgnoreCase(s)) return false;
        return fallback;
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}
