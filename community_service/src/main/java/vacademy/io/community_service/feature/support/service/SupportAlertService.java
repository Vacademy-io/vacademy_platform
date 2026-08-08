package vacademy.io.community_service.feature.support.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.common.logging.SentryLogger;
import vacademy.io.community_service.feature.session.dto.admin.EmailRequestDto;
import vacademy.io.community_service.feature.session.dto.admin.EmailUserDto;
import vacademy.io.community_service.feature.session.manager.NotificationService;
import vacademy.io.community_service.feature.support.client.SupportAnnouncementClient;
import vacademy.io.community_service.feature.support.client.SupportAuthClient;
import vacademy.io.community_service.feature.support.dto.SupportRecipientDto;
import vacademy.io.community_service.feature.support.entity.SupportTicket;
import vacademy.io.community_service.feature.support.enums.TicketPriority;
import vacademy.io.community_service.feature.support.enums.TicketStatus;

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

    /**
     * Link target for the "Open the Support panel" button. Unset by default — the button is left
     * out entirely rather than pointing somewhere that may not exist.
     */
    @Value("${support.portal.url:}")
    private String portalUrl;

    /**
     * Hosted PNG of the Vacademy mark, served from the public media CDN. A PNG rather than the
     * repo's vacademy-logo.svg because mail clients — Gmail especially — do not render SVG.
     * Overridable, but the default is a real, verified-public URL so branding works out of the box.
     */
    @Value("${support.brand.logo.url:https://d1om4dxj9e7kkd.cloudfront.net/ADMIN_PUBLIC_UPLOAD/dd55d3c0-bba3-4111-98e1-0dfe884fa019-vacademy-logo.png}")
    private String logoUrl;

    @Autowired
    private NotificationService notificationService;
    @Autowired
    private SupportAnnouncementClient announcementClient;
    @Autowired
    private SupportAuthClient authClient;

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
     * The customer replied on an existing ticket: alert Sentry→Slack and email the support
     * recipients — the same audience as a new ticket (global + institute alert emails + the
     * institute's assigned engineers), so a reply is never quieter than the ticket it started.
     */
    public void onCustomerReply(SupportTicket ticket, String replyBody, String senderName,
                                List<String> recipientEmails) {
        try {
            String summary = String.format("💬 %s replied on %s: %s",
                    safe(senderName, "Customer"),
                    safe(ticket.getInstituteName(), ticket.getInstituteId()),
                    ticket.getSubject());

            Map<String, String> tags = new HashMap<>();
            tags.put("alert_type", "support_customer_reply");
            tags.put("priority", String.valueOf(ticket.getPriority()));
            tags.put("institute_id", String.valueOf(ticket.getInstituteId()));
            tags.put("ticket_id", String.valueOf(ticket.getId()));
            SentryLogger.logWarning(summary, tags);

            if (recipientEmails == null || recipientEmails.isEmpty()) {
                return;
            }
            String subject = customerReplySubject(ticket);
            String body = buildCustomerReplyEmail(ticket, replyBody, senderName);
            List<EmailUserDto> users = new ArrayList<>();
            for (String email : recipientEmails) {
                users.add(recipient(null, email));
            }
            sendEmail(subject, body, ticket.getId(), users);
        } catch (Exception e) {
            log.error("Failed to dispatch customer-reply alert for {}: {}", ticket.getId(), e.getMessage(), e);
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

            String subject = replySubject(ticket);
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
     * The ticket was resolved or closed by the support team: tell the raiser it is done.
     *
     * <p>Callers must only invoke this on a genuine non-terminal → terminal transition, and never
     * for a customer closing their own ticket — nobody wants an email about their own click.
     */
    public void onTicketResolved(SupportTicket ticket, String senderUserId, String senderName) {
        try {
            if (ticket.isInternalOnly()) {
                return;
            }
            SupportRecipientDto raiser = resolveRaiser(ticket);
            if (raiser == null) {
                log.warn("Ticket {} (institute {}) has no raiser contact — resolution not notified",
                        ticket.getId(), ticket.getInstituteId());
                return;
            }

            String subject = resolvedSubject(ticket);
            String body = buildResolvedEmail(ticket);

            sendEmail(subject, body, ticket.getId(),
                    List.of(recipient(raiser.getUserId(), raiser.getEmail())));

            announcementClient.sendSystemAlert(ticket.getInstituteId(),
                    "Support resolved: " + ticket.getSubject(), body,
                    senderUserId, senderName, List.of(raiser));
        } catch (Exception e) {
            log.error("Failed to dispatch resolution alert for {}: {}", ticket.getId(), e.getMessage(), e);
        }
    }

    /**
     * The institute-side person who raised the ticket, or null when none was recorded.
     *
     * <p>A SUPPORT raisedByRole means the fields describe the support agent who logged the ticket,
     * not anyone at the institute — notifying them would email ourselves.
     *
     * <p>The stored raiser "email" is frequently a <em>username</em>: the login principal carries
     * no email address, so the portal recorded {@code getUsername()} in that column and every
     * reply mail was addressed to something like "topmate_admin". When the stored value is not an
     * address we resolve the real one from auth-service by user id, which repairs those tickets
     * without a migration. Only if that also fails do we give up.
     */
    private SupportRecipientDto resolveRaiser(SupportTicket ticket) {
        if ("SUPPORT".equalsIgnoreCase(ticket.getRaisedByRole())) {
            return null;
        }
        String stored = ticket.getRaisedByEmail();
        if (looksLikeEmail(stored)) {
            return new SupportRecipientDto(ticket.getRaisedByUserId(), stored.trim(),
                    ticket.getRaisedByName());
        }
        SupportRecipientDto resolved = authClient.findById(ticket.getRaisedByUserId());
        if (resolved == null) {
            return null;
        }
        // Keep the ticket's own display name; auth-service is only the source of the address.
        return new SupportRecipientDto(resolved.getUserId(), resolved.getEmail(),
                StringUtils.hasText(ticket.getRaisedByName()) ? ticket.getRaisedByName() : resolved.getName());
    }

    /** Cheap sanity check — enough to tell an address from a username, not RFC validation. */
    private boolean looksLikeEmail(String value) {
        return StringUtils.hasText(value) && value.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    }

    // ---- internals ---------------------------------------------------------------

    private void emailSupportTeam(SupportTicket ticket, String firstMessageBody, List<String> recipientEmails) {
        if (recipientEmails == null || recipientEmails.isEmpty()) {
            return;
        }
        String subject = newTicketSubject(ticket);
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

    /**
     * The team-facing alert when an institute raises an issue. Same brand chrome as the customer
     * mails, but the content is triage information — plan and priority first, because that is what
     * decides who picks it up and how fast.
     */
    private String buildNewTicketEmail(SupportTicket ticket, String firstMessageBody) {
        String meta = metaRow("Institute", safe(ticket.getInstituteName(), ticket.getInstituteId()))
                + metaRow("Raised by", safe(ticket.getRaisedByName(),
                        safe(ticket.getRaisedByEmail(), "unknown")))
                + metaRow("Plan", String.valueOf(ticket.getPlanAtCreation()))
                + metaRow("Category", String.valueOf(ticket.getCategory()));

        String body =
                priorityPill(ticket)
                + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\""
                + " style=\"width:100%;margin:0 0 16px;font-size:14px;line-height:1.6\">"
                + meta + "</table>"
                + "<div style=\"margin:0 0 4px;font-size:13px;font-weight:600;color:#6b7280\">"
                + "Reported issue</div>"
                + "<div style=\"margin:0;padding:2px 0 2px 14px;border-left:3px solid " + BRAND + ";"
                + "font-size:15px;line-height:1.6;color:#111827;white-space:pre-wrap\">"
                + escape(firstMessageBody) + "</div>";

        return shell("New support issue", ticket, body,
                "Open it in the support console to reply.");
    }

    /**
     * The team-facing alert when a customer replies. Same triage chrome as the new-ticket mail;
     * the content is who spoke and what they said, with the ticket's post-reply status — a reply
     * can silently reopen a resolved ticket, and that is exactly what the reader needs to notice.
     */
    private String buildCustomerReplyEmail(SupportTicket ticket, String replyBody, String senderName) {
        String meta = metaRow("Institute", safe(ticket.getInstituteName(), ticket.getInstituteId()))
                + metaRow("From", safe(senderName, "Customer"))
                + metaRow("Status", String.valueOf(ticket.getStatus()))
                + metaRow("Category", String.valueOf(ticket.getCategory()));

        String body =
                priorityPill(ticket)
                + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\""
                + " style=\"width:100%;margin:0 0 16px;font-size:14px;line-height:1.6\">"
                + meta + "</table>"
                + "<div style=\"margin:0 0 4px;font-size:13px;font-weight:600;color:#6b7280\">"
                + "Their reply</div>"
                + "<div style=\"margin:0;padding:2px 0 2px 14px;border-left:3px solid " + BRAND + ";"
                + "font-size:15px;line-height:1.6;color:#111827;white-space:pre-wrap\">"
                + escape(replyBody) + "</div>";

        return shell("Customer replied", ticket, body,
                "Open it in the support console to reply.");
    }

    /** A coloured pill, so MAJOR is obvious at a glance in a crowded inbox. */
    private String priorityPill(SupportTicket ticket) {
        boolean major = ticket.getPriority() == TicketPriority.MAJOR;
        String bg = major ? "#fef2f2" : "#f3f4f6";
        String fg = major ? "#b91c1c" : "#4b5563";
        return "<div style=\"margin:0 0 14px\">"
                + "<span style=\"display:inline-block;padding:3px 10px;border-radius:999px;"
                + "background:" + bg + ";color:" + fg + ";font-size:12px;font-weight:700;"
                + "letter-spacing:.04em\">" + String.valueOf(ticket.getPriority()) + "</span>"
                + "</div>";
    }

    /** Table row rather than a div pair — labels and values stay aligned across mail clients. */
    private String metaRow(String label, String value) {
        return "<tr>"
                + "<td style=\"padding:3px 12px 3px 0;color:#6b7280;white-space:nowrap;"
                + "vertical-align:top\">" + escape(label) + "</td>"
                + "<td style=\"padding:3px 0;color:#111827;font-weight:600\">"
                + escape(value) + "</td></tr>";
    }

    private String buildResolvedEmail(SupportTicket ticket) {
        boolean closed = ticket.getStatus() == TicketStatus.CLOSED;
        String body =
                "<p style=\"margin:0 0 4px;font-size:15px;line-height:1.6;color:#374151\">"
                + "We've " + (closed ? "closed this issue" : "marked this issue resolved") + ". "
                + "If it isn't fully sorted, reply from the Support panel and it reopens "
                + "automatically — there's no need to raise a new one.</p>";
        return emailShell(closed ? "Issue closed" : "Issue resolved", ticket, body);
    }

    private String buildReplyEmail(SupportTicket ticket, String replyBody) {
        String body =
                "<p style=\"margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151\">"
                + "Our support team has replied to your issue:</p>"
                // Left rule rather than a grey fill: it reads as a quote and survives dark mode,
                // where a light background can leave dark text on dark.
                + "<div style=\"margin:0 0 16px;padding:2px 0 2px 14px;border-left:3px solid " + BRAND + ";"
                + "font-size:15px;line-height:1.6;color:#111827;white-space:pre-wrap\">"
                + escape(replyBody) + "</div>"
                + "<p style=\"margin:0;font-size:14px;line-height:1.6;color:#6b7280\">"
                + "You can reply from the Support panel in your dashboard.</p>";
        return emailShell("New reply from support", ticket, body);
    }

    /** Vacademy orange, taken from vacademy-logo.svg and the dashboard's --primary token. */
    private static final String BRAND = "#ED7424";

    /**
     * One shell for every customer-facing support mail, so a reply and a resolution look like the
     * same conversation. Styles are inline and the layout is a single centred column: mail clients
     * strip &lt;style&gt; blocks and handle floats badly.
     */
    /**
     * Customer-facing wrapper: brand chrome, then a CTA, a sign-off, and a footer explaining why
     * they received it. The team alert uses {@link #shell} directly — it wants neither.
     */
    private String emailShell(String heading, SupportTicket ticket, String bodyHtml) {
        String body = bodyHtml
                + ctaButton()
                + "<div style=\"padding:18px 0 0;font-size:15px;line-height:1.6;color:#374151\">"
                + "Regards,<br><span style=\"font-weight:600;color:#111827\">Vacademy Support</span>"
                + "</div>";
        // Raw, not escaped: shell() escapes the footer, and escaping twice would render an
        // institute called "Kids & Co" as "Kids &amp;amp; Co".
        String footer = "You're receiving this because you raised an issue with Vacademy support"
                + (StringUtils.hasText(ticket.getInstituteName())
                        ? " for " + ticket.getInstituteName() : "")
                + ".";
        return shell(heading, ticket, body, footer);
    }

    /**
     * Brand chrome shared by every support mail: rule, centred logo, heading, the issue and its
     * ticket number, then the caller's body and footer. Styles are inline and the layout is a
     * single centred column — mail clients strip &lt;style&gt; blocks and handle floats badly.
     */
    private String shell(String heading, SupportTicket ticket, String bodyHtml, String footerText) {
        String subject = escape(ticket.getSubject());

        return "<div style=\"margin:0;padding:24px 12px;background:#f6f7f9;"
                + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif\">"
                + "<div style=\"max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;"
                + "border-radius:12px;overflow:hidden\">"

                // Brand rule. A flat coloured bar renders identically everywhere, unlike a gradient.
                + "<div style=\"height:4px;background:" + BRAND + ";font-size:0;line-height:0\">&nbsp;</div>"

                // Logo gets its own centred band; the copy below stays left-aligned, which is
                // easier to read than a fully centred email.
                + "<div style=\"padding:28px 24px 22px;text-align:center\">" + brandMark() + "</div>"

                + "<div style=\"padding:0 24px\">"
                + "<h1 style=\"margin:0 0 6px;font-size:20px;line-height:1.3;color:#111827;"
                + "font-weight:600\">" + escape(heading) + "</h1>"
                // The issue title is what the reader recognises — the id is for us, so it is
                // demoted to the footer instead of leading the subject line.
                + "<div style=\"margin:0 0 6px;font-size:15px;color:#4b5563\">"
                + "Issue: <span style=\"color:#111827;font-weight:600\">" + subject + "</span></div>"
                // The reference sits with the issue rather than buried in the footer — it is the
                // thing the reader quotes back when they get in touch.
                + (StringUtils.hasText(ticket.getTicketNumber())
                        ? "<div style=\"margin:0 0 18px;font-size:13px;color:#6b7280\">Ticket "
                          + "<span style=\"font-weight:600;color:" + BRAND + "\">"
                          + escape(ticket.getTicketNumber()) + "</span></div>"
                        : "<div style=\"margin:0 0 18px\"></div>")
                + "</div>"

                + "<div style=\"padding:0 24px 22px\">" + bodyHtml + "</div>"

                // No ticket number here — it is shown beside the issue above, and repeating it
                // twice in a short mail just adds noise.
                + "<div style=\"padding:14px 24px;border-top:1px solid #f0f1f3;background:#fafafa;"
                + "font-size:12px;line-height:1.6;color:#9ca3af\">"
                + escape(footerText)
                + "</div>"

                + "</div></div>";
    }

    /**
     * The wordmark. A text wordmark is the default rather than the fallback: the logo is an SVG,
     * which Gmail strips outright, and image blocking is common enough that a picture-only header
     * often renders as an empty box. Set {@code support.brand.logo.url} to a hosted PNG to use the
     * real mark — the alt text keeps the header readable even when images are blocked.
     */
    private String brandMark() {
        if (StringUtils.hasText(logoUrl)) {
            // width+height attributes as well as CSS: Outlook ignores the style and would
            // otherwise draw the image at its full 256px. inline-block so the parent's
            // text-align:center actually centres it — margin:auto is unreliable in Outlook.
            return "<img src=\"" + logoUrl + "\" alt=\"Vacademy\" width=\"64\" height=\"64\""
                    + " style=\"width:64px;height:64px;display:inline-block;border:0;outline:none;"
                    + "text-decoration:none\">";
        }
        return "<div style=\"font-size:26px;font-weight:700;letter-spacing:-.01em;color:" + BRAND + "\">"
                + "Vacademy</div>";
    }

    /** Rendered only when a portal URL is configured — a dead button is worse than none. */
    private String ctaButton() {
        if (!StringUtils.hasText(portalUrl)) {
            return "";
        }
        return "<div style=\"padding:4px 24px 0\">"
                + "<a href=\"" + portalUrl + "\" style=\"display:inline-block;padding:11px 20px;"
                + "background:" + BRAND + ";color:#ffffff;font-size:14px;font-weight:600;"
                + "text-decoration:none;border-radius:8px\">Open the Support panel</a>"
                + "</div>";
    }


    private String safe(String primary, String fallback) {
        return StringUtils.hasText(primary) ? primary : (fallback == null ? "" : fallback);
    }

    /**
     * Subject lines. The issue title leads because that is what the reader recognises; the
     * reference trails in brackets, where it still threads the conversation in Gmail.
     * Kept as named methods so they can be asserted on without dispatching a real mail.
     */
    /**
     * Team-facing: urgency, then who, then what, with the reference last.
     *
     * <p>Ordered for a crowded inbox. Gmail shows roughly 70 characters on desktop and 35 on
     * mobile, so priority and institute lead — they decide whether a mail is opened now. The old
     * "[Support][PLAN][PRIORITY] subject" form spent its opening characters on three bracket
     * groups, never named the institute at all, and buried the issue in the middle. The plan is
     * dropped rather than shortened: it is derivable from the institute and was crowding out the
     * two fields that actually drive triage.
     */
    String newTicketSubject(SupportTicket ticket) {
        return String.format("%s · %s · %s [%s]",
                ticket.getPriority(),
                safe(ticket.getInstituteName(), ticket.getInstituteId()),
                ticket.getSubject(),
                reference(ticket));
    }

    String replySubject(SupportTicket ticket) {
        return "Re: " + ticket.getSubject() + " [" + reference(ticket) + "]";
    }

    /** Team-facing: who spoke leads, mirroring {@link #newTicketSubject}'s institute-first order. */
    String customerReplySubject(SupportTicket ticket) {
        return String.format("Reply · %s · %s [%s]",
                safe(ticket.getInstituteName(), ticket.getInstituteId()),
                ticket.getSubject(),
                reference(ticket));
    }

    String resolvedSubject(SupportTicket ticket) {
        return "Resolved: " + ticket.getSubject() + " [" + reference(ticket) + "]";
    }

    /**
     * The reference to quote in a subject line. Prefers the human-facing ticket number; falls back
     * to a UUID fragment only for rows that predate numbering or whose allocation failed, so the
     * subject always carries something stable enough to keep the thread together.
     */
    private String reference(SupportTicket ticket) {
        if (StringUtils.hasText(ticket.getTicketNumber())) {
            return ticket.getTicketNumber();
        }
        return "#" + shortId(ticket.getId());
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
