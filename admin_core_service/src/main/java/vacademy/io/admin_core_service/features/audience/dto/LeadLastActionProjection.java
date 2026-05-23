package vacademy.io.admin_core_service.features.audience.dto;

import java.sql.Timestamp;

/**
 * Batch projection: a lead (audience_response id) plus the timestamps of its assigned counselor's
 * FIRST and LAST action on it (from {@code timeline_event}). Used by the leads tables for:
 * <ul>
 *   <li>{@code firstActionAt} → "Responded in N" — time to first response (TAT actual-vs-deadline).</li>
 *   <li>{@code lastActionAt}  → follow-up deadline = lastActionAt + followUpSlaHours.</li>
 * </ul>
 * Counselor is resolved {@code linked_users} first (enquiry leads), else
 * {@code user_lead_profile.assigned_counselor_id} — mirroring the SLA scheduler's resolution.
 */
public interface LeadLastActionProjection {
    String getLeadId();
    Timestamp getFirstActionAt();
    Timestamp getLastActionAt();
}
