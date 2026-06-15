package vacademy.io.admin_core_service.features.audience.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;

import java.util.List;
import java.util.Map;

/**
 * Bell-icon ("system alert") notifications for counsellor lead assignment.
 *
 * Every path that writes user_lead_profile.assigned_counselor_id funnels
 * through here so the counsellor hears about new work the same way no matter
 * HOW the lead arrived:
 *   - pool auto-assign            (CounselorAssignmentService)
 *   - manual assign endpoint      (AudienceController)
 *   - CSV/bulk import lead owner  (AudienceService.assignManualCounsellor)
 *   - workbench bulk reassign     (CounsellorReassignService)
 *   - pool backup reassign        (CounselorPoolService.reassignOpenLeadsToBackup)
 *
 * Best-effort by design: every dispatch is wrapped so a notification-service
 * blip can never fail (or roll back) the assignment that triggered it.
 *
 * Deliberately depends ONLY on the notification client layer — never on the
 * audience / counselor_pool / counsellor_workbench feature services — so it
 * can be injected into all of them without forming a bean cycle.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LeadAssignmentNotifier {

    /** Same alert settings the original pool auto-assign notification used. */
    private static final Map<String, Object> ALERT_SETTINGS = Map.of(
            "priority", 2,
            "isDismissible", true,
            "showBadge", true,
            "isActive", true);

    private final NotificationService notificationService;

    /**
     * One lead assigned to one counsellor. {@code leadName} and
     * {@code campaignName} are both optional — the body degrades gracefully:
     *   - both:          You have a new lead "Asha" from campaign "Spring intake".
     *   - campaign only: You have a new lead from campaign "Spring intake".  (the exact legacy pool-assign text)
     *   - lead only:     You have a new lead "Asha".
     *   - neither:       You have a new lead.
     */
    public void notifyAssigned(String instituteId, String counsellorUserId, String leadName, String campaignName) {
        if (counsellorUserId == null || counsellorUserId.isBlank()) {
            return;
        }
        StringBuilder body = new StringBuilder("You have a new lead");
        if (leadName != null && !leadName.isBlank()) {
            body.append(" \"").append(leadName).append("\"");
        }
        if (campaignName != null && !campaignName.isBlank()) {
            body.append(" from campaign \"").append(campaignName).append("\"");
        }
        body.append(".");
        dispatch(instituteId, counsellorUserId, "New lead assigned", body.toString());
    }

    /**
     * N leads moved to one counsellor in a single operation (workbench
     * reassign, pool backup, …). Sends exactly ONE notification — never one
     * per lead — so a 200-lead reassign doesn't bury the target's bell.
     * {@code contextLabel} is an optional human hint appended in parentheses,
     * e.g. {@code workbench reassign} or {@code backup for pool "North"}.
     */
    public void notifyBatchAssigned(String instituteId, String counsellorUserId, int count, String contextLabel) {
        if (counsellorUserId == null || counsellorUserId.isBlank() || count <= 0) {
            return;
        }
        String title = count == 1 ? "Lead reassigned to you" : "Leads reassigned to you";
        StringBuilder body = new StringBuilder()
                .append(count).append(count == 1 ? " lead" : " leads").append(" reassigned to you");
        if (contextLabel != null && !contextLabel.isBlank()) {
            body.append(" (").append(contextLabel).append(")");
        }
        body.append(".");
        dispatch(instituteId, counsellorUserId, title, body.toString());
    }

    private void dispatch(String instituteId, String counsellorUserId, String title, String body) {
        try {
            notificationService.createSystemAlertAnnouncement(
                    instituteId,
                    List.of(counsellorUserId),
                    title,
                    body,
                    "system",
                    "System",
                    "ADMIN",
                    ALERT_SETTINGS);
        } catch (Exception e) {
            log.warn("Failed to send lead-assignment notification to counsellor={} (institute={}): {}",
                    counsellorUserId, instituteId, e.getMessage());
        }
    }
}
