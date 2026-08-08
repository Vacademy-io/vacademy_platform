package vacademy.io.admin_core_service.features.invoice.enums;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * When the invoice-number counter rolls back to 1. Stored as
 * {@code INVOICE_SETTING.numbering.seqScope}.
 *
 * <p>Each value maps a date onto an {@code invoice.seq_scope_key} (V432). The keys are
 * self-distinguishing by length ({@code ALL} / 4 / 6 / 8 chars), so a single column serves
 * every scope and switching scope cannot collide with another scope's counter.
 */
public enum InvoiceSeqScope {

    /** One ever-increasing counter per institute. */
    NEVER("ALL"),

    /** Resets each calendar year — key {@code "2026"}. */
    YEARLY("yyyy"),

    /** Resets each calendar month — key {@code "202608"}. */
    MONTHLY("yyyyMM"),

    /** Resets each day — key {@code "20260805"}. This is the legacy behaviour. */
    DAILY("yyyyMMdd");

    private final String pattern;

    InvoiceSeqScope(String pattern) {
        this.pattern = pattern;
    }

    /** The {@code invoice.seq_scope_key} this date falls into. */
    public String scopeKey(LocalDate date) {
        if (this == NEVER) {
            return "ALL";
        }
        return DateTimeFormatter.ofPattern(pattern).format(date);
    }

    /**
     * Lenient parser. Unknown / null / blank values fall back to {@link #DAILY}, which
     * is what the hardcoded {@code INV-yyyyMMdd-NNNN} generator did before this feature
     * existed — so an institute with no {@code numbering} block keeps its old behaviour.
     */
    public static InvoiceSeqScope fromSetting(Object raw) {
        if (raw == null) {
            return DAILY;
        }
        try {
            return InvoiceSeqScope.valueOf(raw.toString().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return DAILY;
        }
    }
}
