package vacademy.io.admin_core_service.features.counsellor_target.enums;

/** The timeline a target applies to. Stored as the enum name in counsellor_target.period_type. */
public enum TargetPeriodType {
    /** Recurring — auto-applies to the current (or selected) ISO week. */
    WEEK,
    /** Recurring — auto-applies to the current (or selected) calendar month. */
    MONTH,
    /** One-off, bound to an explicit period_start..period_end range. */
    CUSTOM;

    public static boolean isValid(String v) {
        if (v == null) return false;
        for (TargetPeriodType p : values()) if (p.name().equals(v)) return true;
        return false;
    }
}
