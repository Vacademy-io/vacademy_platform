package vacademy.io.community_service.feature.support.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.common.logging.SentryLogger;
import vacademy.io.community_service.feature.session.dto.admin.EmailRequestDto;
import vacademy.io.community_service.feature.session.dto.admin.EmailUserDto;
import vacademy.io.community_service.feature.session.manager.NotificationService;
import vacademy.io.community_service.feature.support.client.SupportAnnouncementClient;
import vacademy.io.community_service.feature.support.dto.SupportRecipientDto;
import vacademy.io.community_service.feature.support.entity.SupportTicket;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Fans support events out to alert channels. Two channels today:
 *   1. <b>Sentry</b> — a WARNING event (which the team's Sentry→Slack integration forwards to
 *      the support Slack channel). This replaces a bespoke Slack webhook.
 *   2. <b>Email</b> — via the existing notification-service unified-send path.
 *
 * Deliberately decoupled: callers pass the resolved recipient list, so a real Slack webhook (or
 * any other channel) can be slotted in here later without touching the ticket service.
 * Every dispatch is best-effort and never throws back into the request flow.
 */
@Service
@Slf4j
public class SupportAlertService {

    private static final String SOURCE = "SUPPORT_HELPDESK";

    @Autowired
    private NotificationService notificationService;
    @Autowired
    private SupportAnnouncementClient announcementClient;

    /** A new ticket was raised: alert Sentry→Slack and email the support recipients. */
    public void onNewTicket(SupportTicket ticket, String firstMessageBody, List<String> recipientEmails) {
        try {
            String planName = ticket.getPlanAtCreation() != null ? ticket.getPlanAtCreation().name() : "UNKNOWN";
            String summary = String.format("🆘 New %s support issue from %s: %s",
                    planName, safe(ticket.getInstituteName(), ticket.getInstituteId()), ticket.getSubject());

            Map<String, String> tags = new HashMap<>();
            tags.put("alert_type", "support_new_ticket");
            tags.put("support_plan", planName);
            tags.put("priority", String.valueOf(ticket.getPriority()));
            tags.put("category", String.valueOf(ticket.getCategory()));
            tags.put("institute_id", String.valueOf(ticket.getInstituteId()));
            tags.put("ticket_id", String.valueOf(ticket.getId()));
            SentryLogger.logWarning(summary, tags);

            emailSupportTeam(ticket, firstMessageBody, recipientEmails);
        } catch (Exception e) {
            log.error("Failed to dispatch new-ticket alert for {}: {}", ticket.getId(), e.getMessage(), e);
        }
    }

    /**
     * A support agent replied: tell the person who raised the ticket, by email and by in-app
     * system alert.
     *
     * <p>Exactly one recipient, always — the raiser. Never the institute's other admins: they did
     * not raise this and must not be pinged for it.
     */
    public void onSupportReply(SupportTicket ticket, String replyBody,
                               String senderUserId, String senderName) {
        try {
            // Internal-only tickets are support scratch work the institute must never see.
            if (ticket.isInternalOnly()) {
                return;
            }
            SupportRecipientDto raiser = resolveRaiser(ticket);
            if (raiser == null) {
                // Support-logged tickets record no institute-side contact, so there is nobody to
                // tell. Logged rather than silently dropped so the gap is visible.
                log.warn("Ticket {} (institute {}) has no raiser contact — reply not notified",
                        ticket.getId(), ticket.getInstituteId());
                return;
            }

            String subject = "Re: [" + shortId(ticket.getId()) + "] " + ticket.getSubject();
            String body = buildReplyEmail(ticket, replyBody);

            // Deliberately NOT attributed to the ticket's institute. notification-service resolves
            // the FROM address and the CC/BCC rules from the send's instituteId, so attributing
            // this to the customer would post our support reply from *their* configured sender and
            // copy it to their compliance mailbox. Support mail stays on the platform institute.
            sendEmail(subject, body, ticket.getId(),
                    List.of(recipient(raiser.getUserId(), raiser.getEmail())));

            announcementClient.sendSystemAlert(ticket.getInstituteId(),
                    "Support replied: " + ticket.getSubject(), body,
                    senderUserId, senderName, List.of(raiser));
        } catch (Exception e) {
            log.error("Failed to dispatch support-reply alert for {}: {}", ticket.getId(), e.getMessage(), e);
        }
    }

    /**
     * The institute-side person who raised the ticket, or null when none was recorded.
     *
     * <p>A SUPPORT raisedByRole means the fields describe the support agent who logged the ticket,
     * not anyone at the institute — notifying them would email ourselves.
     */
    private SupportRecipientDto resolveRaiser(SupportTicket ticket) {
        if ("SUPPORT".equalsIgnoreCase(ticket.getRaisedByRole())
                || !StringUtils.hasText(ticket.getRaisedByEmail())) {
            return null;
        }
        return new SupportRecipientDto(ticket.getRaisedByUserId(),
                ticket.getRaisedByEmail().trim(), ticket.getRaisedByName());
    }

    // ---- internals ---------------------------------------------------------------

    private void emailSupportTeam(SupportTicket ticket, String firstMessageBody, List<String> recipientEmails) {
        if (recipientEmails == null || recipientEmails.isEmpty()) {
            return;
        }
        String subject = String.format("[Support][%s][%s] %s",
                ticket.getPlanAtCreation(), ticket.getPriority(), ticket.getSubject());
        String body = buildNewTicketEmail(ticket, firstMessageBody);
        List<EmailUserDto> users = new ArrayList<>();
        for (String email : recipientEmails) {
            users.add(recipient(null, email));
        }
        sendEmail(subject, body, ticket.getId(), users);
    }

    private void sendEmail(String subject, String htmlBody, String sourceId, List<EmailUserDto> users) {
        EmailRequestDto dto = new EmailRequestDto();
        dto.setSubject(subject);
        dto.setBody(htmlBody);
        dto.setNotificationType("EMAIL");
        dto.setSource(SOURCE);
        dto.setSourceId(sourceId);
        dto.setUsers(users);
        notificationService.sendEmail(dto);
    }

    private EmailUserDto recipient(String userId, String email) {
        return new EmailUserDto(userId, email, new HashMap<>());
    }

    private String buildNewTicketEmail(SupportTicket ticket, String firstMessageBody) {
        return "<div style=\"font-family:Arial,sans-serif;font-size:14px;color:#1f2937\">"
                + "<h2 style=\"margin:0 0 12px\">New support issue</h2>"
                + row("Institute", safe(ticket.getInstituteName(), ticket.getInstituteId()))
                + row("Plan", String.valueOf(ticket.getPlanAtCreation()))
                + row("Priority", String.valueOf(ticket.getPriority()))
                + row("Category", String.valueOf(ticket.getCategory()))
                + row("Raised by", safe(ticket.getRaisedByName(), ticket.getRaisedByEmail()))
                + row("Subject", ticket.getSubject())
                + "<div style=\"margin-top:12px;padding:12px;background:#f3f4f6;border-radius:8px;white-space:pre-wrap\">"
                + escape(firstMessageBody) + "</div>"
                + "<p style=\"margin-top:16px;color:#6b7280\">Open it in the support console to reply.</p>"
                + "</div>";
    }

    private String buildReplyEmail(SupportTicket ticket, String replyBody) {
        return "<div style=\"font-family:Arial,sans-serif;font-size:14px;color:#1f2937\">"
                + "<p>You have a new reply from the Vacademy support team on your issue "
                + "<strong>" + escape(ticket.getSubject()) + "</strong>:</p>"
                + "<div style=\"margin-top:8px;padding:12px;background:#f3f4f6;border-radius:8px;white-space:pre-wrap\">"
                + escape(replyBody) + "</div>"
                + "<p style=\"margin-top:16px;color:#6b7280\">Reply from the Support panel in your dashboard.</p>"
                + "</div>";
    }

    private String row(String label, String value) {
        return "<div style=\"margin:4px 0\"><strong>" + label + ":</strong> " + escape(value) + "</div>";
    }

    private String safe(String primary, String fallback) {
        return StringUtils.hasText(primary) ? primary : (fallback == null ? "" : fallback);
    }

    private String shortId(String id) {
        if (id == null) {
            return "";
        }
        return id.length() <= 8 ? id : id.substring(0, 8);
    }

    private String escape(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
