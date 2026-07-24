package vacademy.io.community_service.feature.onboarding.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.community_service.feature.onboarding.dto.QuestionDto;
import vacademy.io.community_service.feature.onboarding.entity.OnboardingSubmission;
import vacademy.io.community_service.feature.session.dto.admin.EmailRequestDto;
import vacademy.io.community_service.feature.session.dto.admin.EmailUserDto;
import vacademy.io.community_service.feature.session.manager.NotificationService;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Notifies the super-admin team when a new onboarding form arrives.
 *   1. An INFO log line (routine lead — intentionally not a Sentry warning/incident).
 *   2. Email to every active recipient via the notification-service unified-send path.
 * Best-effort and never throws back into the request flow.
 */
@Service
@Slf4j
public class OnboardingAlertService {

    private static final String SOURCE = "ONBOARDING";

    @Autowired
    private NotificationService notificationService;
    @Autowired
    private QuestionCatalog catalog;

    /** @return true if the email dispatch was attempted (recipients present). */
    public boolean onNewSubmission(OnboardingSubmission s, Map<String, Object> answers,
                                   String demoLabel, List<String> recipientEmails) {
        try {
            String summary = String.format("📝 New onboarding: %s (%s) — %s",
                    safe(s.getOrganizationName(), s.getContactName()),
                    s.getInstituteType() == null ? "?" : s.getInstituteType(),
                    safe(s.getContactEmail(), "no email"));

            log.info("New onboarding submission {} — {}", s.getId(), summary);

            if (recipientEmails == null || recipientEmails.isEmpty()) {
                return false;
            }
            String subject = String.format("[Onboarding] %s — %s",
                    safe(s.getOrganizationName(), s.getContactName()),
                    s.getInstituteType() == null ? "" : s.getInstituteType());
            String body = buildEmail(s, answers, demoLabel);
            List<EmailUserDto> users = new ArrayList<>();
            for (String email : recipientEmails) {
                users.add(new EmailUserDto(null, email, new HashMap<>()));
            }
            EmailRequestDto dto = new EmailRequestDto();
            dto.setSubject(subject);
            dto.setBody(body);
            dto.setNotificationType("EMAIL");
            dto.setSource(SOURCE);
            dto.setSourceId(s.getId());
            dto.setUsers(users);
            notificationService.sendEmail(dto);
            return true;
        } catch (Exception e) {
            log.error("Failed to dispatch onboarding alert for {}: {}", s.getId(), e.getMessage(), e);
            return false;
        }
    }

    private String buildEmail(OnboardingSubmission s, Map<String, Object> answers, String demoLabel) {
        StringBuilder sb = new StringBuilder();
        sb.append("<div style=\"font-family:Arial,sans-serif;font-size:14px;color:#1f2937\">");
        sb.append("<h2 style=\"margin:0 0 12px\">New onboarding submission</h2>");
        sb.append(row("Organization", s.getOrganizationName()));
        sb.append(row("Contact", safe(s.getContactName(), s.getContactEmail())));
        sb.append(row("Email", s.getContactEmail()));
        sb.append(row("Phone", s.getContactPhone()));
        sb.append(row("Institute type", s.getInstituteType()));
        sb.append(row("Routed demo", demoLabel));
        sb.append(row("Link", s.getLinkSlug() + " (" + s.getLinkType() + ")"));

        sb.append("<h3 style=\"margin:16px 0 8px\">All answers</h3>");
        sb.append("<div style=\"padding:12px;background:#f3f4f6;border-radius:8px\">");
        if (answers != null) {
            for (QuestionDto q : catalog.all()) {
                Object val = answers.get(q.getKey());
                if (val == null || String.valueOf(val).isBlank()) continue;
                sb.append(row(q.getLabel(), String.valueOf(val)));
            }
        }
        sb.append("</div>");
        sb.append("<p style=\"margin-top:16px;color:#6b7280\">Open the Onboarding tab in the super-admin dashboard for the full record.</p>");
        sb.append("</div>");
        return sb.toString();
    }

    private String row(String label, String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return "<div style=\"margin:4px 0\"><strong>" + escape(label) + ":</strong> " + escape(value) + "</div>";
    }

    private String safe(String primary, String fallback) {
        return StringUtils.hasText(primary) ? primary : (fallback == null ? "" : fallback);
    }

    private String escape(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
