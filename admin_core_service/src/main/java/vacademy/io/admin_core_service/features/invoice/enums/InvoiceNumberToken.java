package vacademy.io.admin_core_service.features.invoice.enums;

import java.util.Arrays;
import java.util.Optional;

/**
 * The catalogue of tokens an admin can put in an invoice-number format.
 *
 * <p>This enum is the single source of truth: the formatter resolves from it, the
 * validator rejects anything not in it, and {@code GET /v1/invoices/numbering/tokens}
 * serves it to the settings UI so the click-to-insert palette can never drift out of
 * sync with what the backend actually understands.
 *
 * <p>{@code maxWidth} is the worst-case rendered width, used to prove a format can never
 * exceed the VARCHAR(100) column before it is saved.
 */
public enum InvoiceNumberToken {

    // ── Sequence ────────────────────────────────────────────────────────────
    SEQ("seq", "Sequence number", Group.SEQUENCE, "0042", 12, false),

    // ── Institute (all free — already loaded when the number is generated) ──
    INSTITUTE_CODE("institute_code", "Institute code", Group.INSTITUTE, "ACME", 12, false),
    INSTITUTE_NAME("institute_name", "Institute name", Group.INSTITUTE, "ACMEACADEMY", 12, false),
    STATE_CODE("state_code", "State code (GST)", Group.INSTITUTE, "27", 2, false),
    INSTITUTE_CITY("institute_city", "Institute city", Group.INSTITUTE, "MUMBAI", 12, false),
    INSTITUTE_STATE("institute_state", "Institute state", Group.INSTITUTE, "MAHARASHTRA", 12, false),
    INSTITUTE_COUNTRY("institute_country", "Institute country", Group.INSTITUTE, "INDIA", 12, false),
    SUBDOMAIN("subdomain", "Subdomain", Group.INSTITUTE, "ACME", 12, false),

    // ── Learner — risky for tax: they make numbering non-sequential ─────────
    LEARNER_NAME("learner_name", "Learner name", Group.LEARNER, "RAHULSHARMA", 12, true),
    LEARNER_INITIALS("learner_initials", "Learner initials", Group.LEARNER, "RS", 4, true),
    LEARNER_STATE("learner_state", "Learner state", Group.LEARNER, "MAHARASHTRA", 12, true),
    ENROLLMENT_NO("enrollment_no", "Enrollment number", Group.LEARNER, "482910", 12, true),

    // ── Date ────────────────────────────────────────────────────────────────
    YYYY("YYYY", "Year (2026)", Group.DATE, "2026", 4, false),
    YY("YY", "Year (26)", Group.DATE, "26", 2, false),
    MM("MM", "Month (08)", Group.DATE, "08", 2, false),
    MMM("MMM", "Month (Aug)", Group.DATE, "AUG", 3, false),
    DD("DD", "Day (05)", Group.DATE, "05", 2, false),
    YYYYMM("YYYYMM", "Year + month", Group.DATE, "202608", 6, false),
    YYYYMMDD("YYYYMMDD", "Full date", Group.DATE, "20260805", 8, false),
    FY("FY", "Financial year (2026-27)", Group.DATE, "2026-27", 7, false),
    FYY("FYY", "Financial year (26-27)", Group.DATE, "26-27", 5, false),
    Q("Q", "Calendar quarter", Group.DATE, "3", 1, false),
    FQ("FQ", "Fiscal quarter", Group.DATE, "2", 1, false),

    // ── Transaction & context ───────────────────────────────────────────────
    CURRENCY("currency", "Currency code", Group.TRANSACTION, "INR", 3, false),
    PAYMENT_VENDOR("payment_vendor", "Payment gateway", Group.TRANSACTION, "RAZORPAY", 12, false),
    PLAN_NAME("plan_name", "Plan name", Group.TRANSACTION, "ANNUALPLAN", 12, true),
    DOC_TYPE("doc_type", "Document type", Group.TRANSACTION, "INV", 6, false),
    COURSE_NAME("course_name", "Course name", Group.TRANSACTION, "PHYSICS101", 12, true),
    LEVEL_NAME("level_name", "Level name", Group.TRANSACTION, "BEGINNER", 12, true),
    SESSION_NAME("session_name", "Session name", Group.TRANSACTION, "2026", 12, true);

    public enum Group { SEQUENCE, INSTITUTE, LEARNER, DATE, TRANSACTION }

    private final String key;
    private final String label;
    private final Group group;
    private final String example;
    private final int maxWidth;
    private final boolean riskyForTax;

    InvoiceNumberToken(String key, String label, Group group, String example,
                       int maxWidth, boolean riskyForTax) {
        this.key = key;
        this.label = label;
        this.group = group;
        this.example = example;
        this.maxWidth = maxWidth;
        this.riskyForTax = riskyForTax;
    }

    public String getKey() { return key; }
    public String getLabel() { return label; }
    public Group getGroup() { return group; }
    public String getExample() { return example; }
    public int getMaxWidth() { return maxWidth; }

    /**
     * True for tokens that break strict sequential numbering. Most tax regimes require
     * invoice numbers to be sequential, so the settings UI badges these and the change
     * dialog escalates to type-to-confirm when one is used.
     */
    public boolean isRiskyForTax() { return riskyForTax; }

    /** True when resolving this token needs a DB read the invoice flow doesn't already do. */
    public boolean isLazy() {
        return this == ENROLLMENT_NO || this == COURSE_NAME
                || this == LEVEL_NAME || this == SESSION_NAME;
    }

    /** Free-text tokens that get uppercased / stripped / truncated when sanitising. */
    public boolean isFreeText() {
        return switch (this) {
            case INSTITUTE_NAME, INSTITUTE_CITY, INSTITUTE_STATE, INSTITUTE_COUNTRY, SUBDOMAIN,
                 LEARNER_NAME, LEARNER_INITIALS, LEARNER_STATE, ENROLLMENT_NO,
                 PAYMENT_VENDOR, PLAN_NAME, COURSE_NAME, LEVEL_NAME, SESSION_NAME,
                 INSTITUTE_CODE -> true;
            default -> false;
        };
    }

    /** Case-sensitive lookup — {@code MM} (month) and {@code mm} are not interchangeable. */
    public static Optional<InvoiceNumberToken> fromKey(String key) {
        return Arrays.stream(values()).filter(t -> t.key.equals(key)).findFirst();
    }
}
