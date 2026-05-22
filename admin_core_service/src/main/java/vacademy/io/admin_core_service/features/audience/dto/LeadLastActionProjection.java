package vacademy.io.admin_core_service.features.audience.dto;

import java.sql.Timestamp;

/**
 * Batch projection: a lead (audience_response id) and the timestamp of its assigned counselor's most
 * recent action on it. Used to compute the follow-up deadline (lastActionAt + followUpSlaHours) for the
 * leads tables. Counselor is resolved {@code linked_users} first (enquiry leads), else
 * {@code user_lead_profile.assigned_counselor_id} — mirroring the SLA scheduler's resolution.
 */
public interface LeadLastActionProjection {
    String getLeadId();
    Timestamp getLastActionAt();
}
