package vacademy.io.admin_core_service.features.counsellor_target.enums;

/** What a counsellor target measures. Stored as the enum name in counsellor_target.metric. */
public enum TargetMetric {
    /** Conversions (deals closed) in the window — from getCounselorPerformance. */
    CONVERSIONS,
    /** Distinct leads assigned in the window — from getCounselorPerformance. */
    LEADS_ASSIGNED,
    /** Calls placed in the window — counted from telephony_call_log. */
    CALLS_MADE;

    public static boolean isValid(String v) {
        if (v == null) return false;
        for (TargetMetric m : values()) if (m.name().equals(v)) return true;
        return false;
    }
}
