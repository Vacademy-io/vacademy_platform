package vacademy.io.community_service.feature.support.enums;

/**
 * The canonical catalogue of support plans and their SLAs. This is the SINGLE SOURCE of
 * truth for SLA text/hours — the frontends fetch it via the {@code /plans} endpoints rather
 * than hardcoding any of it.
 *
 * <p>{@code majorSlaHours}/{@code minorSlaHours} drive the "first response due by" timestamp.
 * A {@code null} means no SLA (the NONE plan).
 */
public enum SupportPlan {

    DEDICATED(
            "Dedicated Support",
            "A dedicated engineer is assigned to your account for hands-on, priority help.",
            "24/7",
            3, "within 3 hours",
            12, "within 12 hours",
            true),

    PREMIUM(
            "Premium Support",
            "24/7 support. Major issues resolved within 3–5 hours, minor issues within 24 hours.",
            "24/7",
            5, "within 3–5 hours",
            24, "within 24 hours",
            false),

    AVERAGE(
            "Average Support",
            "Support from 9 AM to 6 PM. Major issues resolved within 7–10 hours, minor within 2–3 days.",
            "9 AM – 6 PM",
            10, "within 7–10 hours",
            72, "within 2–3 days",
            false),

    LOW(
            "Low Support",
            "Support from 9 AM to 6 PM. Major issues resolved within 2 days, minor within 1 week.",
            "9 AM – 6 PM",
            48, "within 2 days",
            168, "within 1 week",
            false),

    NONE(
            "No Support",
            "No support plan is currently active for this account.",
            "—",
            null, "—",
            null, "—",
            false);

    public static final SupportPlan DEFAULT = PREMIUM;

    private final String displayName;
    private final String description;
    private final String hoursOfOperation;
    private final Integer majorSlaHours;
    private final String majorSlaText;
    private final Integer minorSlaHours;
    private final String minorSlaText;
    private final boolean dedicatedEngineer;

    SupportPlan(String displayName, String description, String hoursOfOperation,
                Integer majorSlaHours, String majorSlaText,
                Integer minorSlaHours, String minorSlaText,
                boolean dedicatedEngineer) {
        this.displayName = displayName;
        this.description = description;
        this.hoursOfOperation = hoursOfOperation;
        this.majorSlaHours = majorSlaHours;
        this.majorSlaText = majorSlaText;
        this.minorSlaHours = minorSlaHours;
        this.minorSlaText = minorSlaText;
        this.dedicatedEngineer = dedicatedEngineer;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }

    public String getHoursOfOperation() {
        return hoursOfOperation;
    }

    public Integer getMajorSlaHours() {
        return majorSlaHours;
    }

    public String getMajorSlaText() {
        return majorSlaText;
    }

    public Integer getMinorSlaHours() {
        return minorSlaHours;
    }

    public String getMinorSlaText() {
        return minorSlaText;
    }

    public boolean isDedicatedEngineer() {
        return dedicatedEngineer;
    }

    /** SLA hours for the given priority, or {@code null} if the plan carries no SLA. */
    public Integer slaHours(TicketPriority priority) {
        return priority == TicketPriority.MAJOR ? majorSlaHours : minorSlaHours;
    }

    public String slaText(TicketPriority priority) {
        return priority == TicketPriority.MAJOR ? majorSlaText : minorSlaText;
    }

    public static SupportPlan fromName(String value) {
        if (value == null) {
            return DEFAULT;
        }
        try {
            return SupportPlan.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return DEFAULT;
        }
    }
}
