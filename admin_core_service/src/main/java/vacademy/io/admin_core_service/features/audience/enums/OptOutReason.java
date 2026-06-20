package vacademy.io.admin_core_service.features.audience.enums;

/**
 * Why a lead was moved into the opt-out audience. Drives both the conversion_status
 * stamped on the opt-out entry and the timing of the opt-out message drip:
 *
 * <ul>
 *   <li>{@link #EXPLICIT} — the lead actively opted out (tapped opt-out / sent STOP).
 *       MSG1 is sent immediately by the AUDIENCE_OPT_OUT trigger workflow; the entry is
 *       anchored to today so MSG2 lands +2 days.</li>
 *   <li>{@link #INACTIVE} — the lead was auto-opted-out after going silent. No immediate
 *       send; the entry is anchored to tomorrow so the 9 AM MSG1 workflow sends the next
 *       morning, and MSG2 lands +2 days after that.</li>
 * </ul>
 */
public enum OptOutReason {
    EXPLICIT,
    INACTIVE;

    /** conversion_status value stamped on the opt-out audience_response. */
    public String conversionStatus() {
        return "OPT_OUT_" + name();
    }
}
