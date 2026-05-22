package vacademy.io.admin_core_service.features.audience.dto;

import java.sql.Timestamp;

/**
 * Projection for the TAT / Follow-up SLA scan. Carries one open, assigned, unconverted lead plus the
 * resolved counselor and the timestamp of that counselor's last action on the lead, so the scheduler can
 * decide (in Java) which workflow trigger stage to emit. Counselor is resolved {@code linked_users} first
 * (enquiry leads), else {@code user_lead_profile.assigned_counselor_id}.
 */
public interface LeadSlaCandidate {
    String getLeadId();
    String getUserId();
    String getStudentUserId();
    String getEnquiryId();
    String getAudienceId();
    String getCampaignName();
    String getInstituteId();
    String getParentName();
    String getParentEmail();
    String getParentMobile();
    Timestamp getSubmittedAt();
    String getCounselorId();
    String getTatReminderStage();
    Integer getTatReminderCount();
    String getTatReminderAssigneeId();
    /** Most recent timeline_event by the resolved counselor on this lead; null if never acted. */
    Timestamp getLastCounselorActionAt();
}
