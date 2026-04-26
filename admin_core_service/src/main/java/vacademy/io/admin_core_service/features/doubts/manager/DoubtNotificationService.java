package vacademy.io.admin_core_service.features.doubts.manager;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.doubts.entity.Doubts;
import vacademy.io.admin_core_service.features.institute.dto.settings.doubt_management.DoubtManagementSettingDataDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.doubt_management.DoubtManagementSettingDataDto.DoubtNotificationChannelPrefs;
import vacademy.io.admin_core_service.features.institute.entity.Template;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.repository.TemplateRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.institute.entity.Institute;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Dispatches doubt-related notifications (push + email) driven by the institute's
 * {@code DOUBT_MANAGEMENT_SETTING.notifications} block.
 *
 * <p>Branding + sender resolution (applied to every email this service sends):
 * <ul>
 *   <li>{@code from_email}: institute's configured {@code EMAIL_SETTING.UTILITY_EMAIL.from} →
 *       fallback to {@link #FALLBACK_SUPPORT_EMAIL}. Passed explicitly so notification-service's
 *       env-var global default can't accidentally leak a different address.</li>
 *   <li>{@code from_name}: institute's name.</li>
 *   <li>{@code {{institute_name}}}, {@code {{institute_theme_color}}}, {@code {{support_email}}}
 *       placeholders are injected into the template alongside the per-doubt variables so the same
 *       template can render under each institute's brand.</li>
 * </ul>
 *
 * <p>Notification failures never propagate back to the doubt-create/resolve flow — logged and dropped.
 */
@Slf4j
@Service
public class DoubtNotificationService {

    private static final String PUSH_TITLE_RAISED = "New doubt raised";
    private static final String PUSH_TITLE_RESOLVED = "Your doubt was resolved";
    private static final String EMAIL_TYPE = "UTILITY_EMAIL";

    /** Priority used for the bell-icon system alert. 2 = medium (matches live-session alerts). */
    private static final int ALERT_PRIORITY_DEFAULT = 2;

    /** Last-resort sender when an institute has no utility email configured. */
    private static final String FALLBACK_SUPPORT_EMAIL = "support@vacademy.io";
    /** Matches the default in DynamicNotificationService's theme resolver. */
    private static final String FALLBACK_THEME_COLOR = "#FF9800";

    /**
     * Sentinel {@code institute_id} for the single global default template row. V215 inserts
     * one row per doubt event under this id; every institute without a custom override resolves
     * to it at send time. Never appears in an admin's Templates UI (which lists by real
     * institute_id). Matches the existing convention in this codebase (e.g.
     * {@code default-otp-template-001}).
     */
    private static final String DEFAULT_INSTITUTE_ID = "DEFAULT";

    @Autowired
    private InstituteSettingService instituteSettingService;

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private TemplateRepository templateRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private NotificationService notificationService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * @param assigneeUserIds recipients for push/email. For "raised" event these are the auto- or
     *                        explicitly-assigned faculty from {@code doubt_assignee} (status=ACTIVE).
     *                        Empty list → skipped entirely (no one to notify).
     */
    public void notifyDoubtRaised(Doubts doubt, List<String> assigneeUserIds, String instituteId) {
        if (doubt == null || assigneeUserIds == null || assigneeUserIds.isEmpty()) return;
        if (instituteId == null || instituteId.isEmpty()) return;

        DoubtNotificationChannelPrefs prefs = resolvePrefs(instituteId, /*raised*/ true);
        if (prefs == null) return;

        boolean pushOn = prefs.getPushEnabled() == null || Boolean.TRUE.equals(prefs.getPushEnabled());
        boolean emailOn = Boolean.TRUE.equals(prefs.getEmailEnabled());
        boolean systemAlertOn = prefs.getSystemAlertEnabled() == null
                || Boolean.TRUE.equals(prefs.getSystemAlertEnabled());

        InstituteContext ctx = loadInstituteContext(instituteId);
        Map<String, String> pushData = buildPushData(doubt, "DOUBT_RAISED");
        String pushBody = summarizeDoubt(doubt);

        if (pushOn) {
            safePush(instituteId, assigneeUserIds, PUSH_TITLE_RAISED, pushBody, pushData);
        }

        if (emailOn) {
            String templateId = resolveTemplateId(prefs.getEmailTemplateId(), instituteId,
                    DoubtNotificationTemplateDefaults.RAISED_TEMPLATE_NAME);
            if (templateId != null) {
                safeEmail(instituteId, assigneeUserIds, templateId,
                        buildPlaceholders(doubt, null, ctx), ctx);
            }
        }

        if (systemAlertOn) {
            // createdByRole="ADMIN" bypasses the institute's optional announcement_approval_required
            // gate (see AnnouncementService.createAnnouncement:94) — system-generated doubt alerts
            // must never wait for a human to approve them. We keep createdBy=learnerId for audit
            // traceability on the teacher-facing bell entry.
            dispatchSystemAlert(instituteId, assigneeUserIds, PUSH_TITLE_RAISED,
                    pushBody == null || pushBody.isEmpty() ? "A learner is waiting for your reply." : pushBody,
                    doubt.getUserId(), ctx, "ADMIN");
        }
    }

    public void notifyDoubtResolved(Doubts doubt, String instituteId) {
        if (doubt == null || doubt.getUserId() == null || doubt.getUserId().isEmpty()) return;
        if (instituteId == null || instituteId.isEmpty()) return;

        DoubtNotificationChannelPrefs prefs = resolvePrefs(instituteId, /*raised*/ false);
        if (prefs == null) return;

        boolean pushOn = prefs.getPushEnabled() == null || Boolean.TRUE.equals(prefs.getPushEnabled());
        boolean emailOn = Boolean.TRUE.equals(prefs.getEmailEnabled());
        boolean systemAlertOn = prefs.getSystemAlertEnabled() == null
                || Boolean.TRUE.equals(prefs.getSystemAlertEnabled());

        InstituteContext ctx = loadInstituteContext(instituteId);
        List<String> recipient = List.of(doubt.getUserId());
        Map<String, String> pushData = buildPushData(doubt, "DOUBT_RESOLVED");
        String pushBody = "Your doubt has been resolved. Tap to view the reply.";

        if (pushOn) {
            safePush(instituteId, recipient, PUSH_TITLE_RESOLVED, pushBody, pushData);
        }

        if (emailOn) {
            String templateId = resolveTemplateId(prefs.getEmailTemplateId(), instituteId,
                    DoubtNotificationTemplateDefaults.RESOLVED_TEMPLATE_NAME);
            if (templateId != null) {
                safeEmail(instituteId, recipient, templateId,
                        buildPlaceholders(doubt, null, ctx), ctx);
            }
        }

        if (systemAlertOn) {
            dispatchSystemAlert(instituteId, recipient, PUSH_TITLE_RESOLVED, pushBody,
                    /* createdBy = doubt system */ null, ctx, "ADMIN");
        }
    }

    /**
     * Creates an Announcement with modeType=SYSTEM_ALERT in notification-service so the
     * recipients' bell lights up. {@code createdByRole="ADMIN"} bypasses the institute's
     * optional approval gate (see AnnouncementService.createAnnouncement:94).
     *
     * <p>{@code createdBy} is a best-effort author tag: for the "raised" event it's the learner's
     * userId so an admin viewing the alert knows who triggered it; for the "resolved" event we
     * fall back to "system" since the operator is often an admin and we don't want to leak their id
     * into the learner's alert metadata.
     */
    private void dispatchSystemAlert(String instituteId, List<String> userIds, String title,
                                     String body, String createdBy, InstituteContext ctx,
                                     String createdByRole) {
        if (userIds == null || userIds.isEmpty()) return;
        try {
            Map<String, Object> settings = new HashMap<>();
            settings.put("priority", ALERT_PRIORITY_DEFAULT);
            settings.put("isDismissible", true);
            settings.put("showBadge", true);
            settings.put("isActive", true);
            notificationService.createSystemAlertAnnouncement(
                    instituteId, userIds, title, body,
                    createdBy != null && !createdBy.isEmpty() ? createdBy : "system",
                    ctx != null && ctx.instituteName != null && !ctx.instituteName.isEmpty()
                            ? ctx.instituteName : "System",
                    createdByRole,
                    settings);
        } catch (Exception e) {
            log.warn("Doubt system alert dispatch failed (institute={}): {}", instituteId, e.getMessage());
        }
    }

    /**
     * Three-layer resolution. The second and third layers share the same name lookup pattern and
     * differ only in the {@code institute_id} they query:
     *   1. Admin-configured template id from DOUBT_MANAGEMENT_SETTING → use it.
     *   2. Institute-specific custom row
     *      {@code (institute_id = <real>, name = defaultName, type = 'EMAIL')}.
     *      Only exists when an admin has explicitly customized the default by creating a same-
     *      named row in their institute.
     *   3. Global default row
     *      {@code (institute_id = 'DEFAULT', name = defaultName, type = 'EMAIL')}.
     *      Seeded by V215. Every institute shares this one row.
     *
     * Returns null only when all three layers miss — caller skips email dispatch. Push is
     * unaffected. A missing global default means someone deleted the V215 row on purpose, so we
     * respect the opt-out instead of forcing a send.
     */
    private String resolveTemplateId(String configuredId, String instituteId, String defaultName) {
        if (configuredId != null && !configuredId.isBlank()) {
            if (templateRepository.existsById(configuredId)) return configuredId;
            log.warn("Configured doubt email template {} missing from DB; trying institute override next",
                    configuredId);
        }
        Optional<Template> instituteOverride =
                templateRepository.findByInstituteIdAndNameAndType(instituteId, defaultName, "EMAIL");
        if (instituteOverride.isPresent()) return instituteOverride.get().getId();

        Optional<Template> globalDefault =
                templateRepository.findByInstituteIdAndNameAndType(DEFAULT_INSTITUTE_ID, defaultName, "EMAIL");
        if (globalDefault.isPresent()) return globalDefault.get().getId();

        log.warn("No doubt email template '{}' found (institute={} nor {}); skipping email dispatch.",
                defaultName, instituteId, DEFAULT_INSTITUTE_ID);
        return null;
    }

    private DoubtNotificationChannelPrefs resolvePrefs(String instituteId, boolean raised) {
        try {
            Object raw = instituteSettingService.getSettingByInstituteIdAndKey(
                    instituteId, SettingKeyEnums.DOUBT_MANAGEMENT_SETTING.name());
            if (raw == null) {
                // No setting at all → apply defaults: push ON, email ON.
                // Email default flipped to true so freshly-onboarded institutes get the
                // notifications out-of-the-box; admins who want to silence them can toggle off
                // from the Doubt Management settings page. The seeded global default templates
                // (V215) guarantee a working email template even without explicit institute config.
                return DoubtNotificationChannelPrefs.builder().pushEnabled(true).emailEnabled(true).systemAlertEnabled(true).build();
            }
            DoubtManagementSettingDataDto setting = objectMapper.convertValue(raw, DoubtManagementSettingDataDto.class);
            if (setting.getNotifications() == null) {
                return DoubtNotificationChannelPrefs.builder().pushEnabled(true).emailEnabled(true).systemAlertEnabled(true).build();
            }
            DoubtNotificationChannelPrefs event = raised
                    ? setting.getNotifications().getOnDoubtRaised()
                    : setting.getNotifications().getOnDoubtResolved();
            if (event == null) {
                return DoubtNotificationChannelPrefs.builder().pushEnabled(true).emailEnabled(true).systemAlertEnabled(true).build();
            }
            return event;
        } catch (Exception e) {
            log.warn("Failed to read doubt notification prefs for institute {}: {}", instituteId, e.getMessage());
            return null;
        }
    }

    private void safePush(String instituteId, List<String> userIds, String title, String body,
                          Map<String, String> data) {
        try {
            notificationService.sendPushViaUnified(instituteId, userIds, title, body, data);
        } catch (Exception e) {
            log.warn("Doubt push notification dispatch failed (doubtId={}): {}",
                    data.get("doubt_id"), e.getMessage());
        }
    }

    private void safeEmail(String instituteId, List<String> userIds, String templateId,
                           Map<String, String> placeholders, InstituteContext ctx) {
        Optional<Template> templateOpt = templateRepository.findById(templateId);
        if (templateOpt.isEmpty()) {
            // Defence-in-depth: resolveTemplateId already checked existsById, but a race with an
            // admin deleting the row between calls is theoretically possible.
            log.warn("Email template {} disappeared between resolution and load; skipping dispatch", templateId);
            return;
        }
        Template template = templateOpt.get();

        List<UserDTO> users;
        try {
            users = authService.getUsersFromAuthServiceByUserIds(userIds);
        } catch (Exception e) {
            log.warn("Failed to resolve users for email dispatch (ids={}): {}", userIds, e.getMessage());
            return;
        }

        for (UserDTO user : users) {
            if (user == null || user.getEmail() == null || user.getEmail().isBlank()) continue;
            Map<String, String> perUser = new HashMap<>(placeholders);
            perUser.put("recipient_name", safeName(user.getFullName()));
            String subject = applyPlaceholders(template.getSubject(), perUser);
            String body = applyPlaceholders(template.getContent(), perUser);
            try {
                notificationService.sendHtmlEmailViaUnified(
                        user.getEmail(), subject, body, instituteId,
                        ctx.fromEmail, ctx.fromName, EMAIL_TYPE);
            } catch (Exception e) {
                log.warn("Failed to send doubt email to {}: {}", user.getEmail(), e.getMessage());
            }
        }
    }

    private Map<String, String> buildPushData(Doubts doubt, String event) {
        Map<String, String> data = new HashMap<>();
        data.put("event", event);
        data.put("doubt_id", safe(doubt.getId()));
        data.put("batch_id", safe(doubt.getPackageSessionId()));
        data.put("source", safe(doubt.getSource()));
        data.put("source_id", safe(doubt.getSourceId()));
        return data;
    }

    private Map<String, String> buildPlaceholders(Doubts doubt, String recipientName, InstituteContext ctx) {
        Map<String, String> m = new HashMap<>();
        m.put("doubt_id", safe(doubt.getId()));
        m.put("batch_id", safe(doubt.getPackageSessionId()));
        m.put("doubt_text", summarizeDoubt(doubt));
        m.put("student_id", safe(doubt.getUserId()));
        m.put("recipient_name", safe(recipientName));
        m.put("institute_name", ctx.instituteName);
        m.put("institute_theme_color", ctx.themeColor);
        // Aliases so a template author can use whichever placeholder name matches the rest of the
        // platform's templates: live-class emails ship with {{THEME_COLOR}} (uppercase), invitation
        // emails use {{themeColor}} (camelCase). Same resolved hex regardless of casing.
        m.put("THEME_COLOR", ctx.themeColor);
        m.put("themeColor", ctx.themeColor);
        m.put("INSTITUTE_NAME", ctx.instituteName);
        m.put("support_email", ctx.fromEmail);
        return m;
    }

    /**
     * Loads the institute row and derives (a) the "from" identity for outgoing emails and (b) the
     * branding placeholders. Any lookup failure degrades to safe defaults so dispatch still works.
     */
    private InstituteContext loadInstituteContext(String instituteId) {
        String instituteName = "";
        String themeColor = FALLBACK_THEME_COLOR;
        String fromEmail = FALLBACK_SUPPORT_EMAIL;
        String fromName = null;

        try {
            Optional<Institute> opt = instituteRepository.findById(instituteId);
            if (opt.isPresent()) {
                Institute institute = opt.get();
                if (institute.getInstituteName() != null) {
                    instituteName = institute.getInstituteName();
                    fromName = instituteName;
                }
                themeColor = normalizeThemeColor(institute.getInstituteThemeCode());
                fromEmail = resolveUtilityFromEmail(institute).orElse(FALLBACK_SUPPORT_EMAIL);
            }
        } catch (Exception e) {
            log.warn("Failed to load institute context for {}: {}", instituteId, e.getMessage());
        }
        return new InstituteContext(instituteName, themeColor, fromEmail, fromName);
    }

    /**
     * Parses {@code institute.setting → EMAIL_SETTING.data.UTILITY_EMAIL.from} and returns the
     * address portion (strips a {@code "Display Name <email>"} wrapper if present). Returns empty
     * when not configured — caller should use {@link #FALLBACK_SUPPORT_EMAIL}.
     */
    private Optional<String> resolveUtilityFromEmail(Institute institute) {
        if (institute == null || institute.getSetting() == null || institute.getSetting().isBlank()) {
            return Optional.empty();
        }
        try {
            JsonNode root = objectMapper.readTree(institute.getSetting());
            JsonNode fromNode = root.path("setting")
                    .path("EMAIL_SETTING")
                    .path("data")
                    .path("UTILITY_EMAIL")
                    .path("from");
            if (fromNode.isMissingNode() || !fromNode.isTextual()) return Optional.empty();

            String fromRaw = fromNode.asText("").trim();
            if (fromRaw.isEmpty()) return Optional.empty();

            // Accept either "address@x" or "Display Name <address@x>".
            if (fromRaw.contains("<") && fromRaw.contains(">")) {
                int lt = fromRaw.indexOf('<');
                int gt = fromRaw.indexOf('>');
                if (gt > lt + 1) {
                    return Optional.of(fromRaw.substring(lt + 1, gt).trim());
                }
            }
            return Optional.of(fromRaw);
        } catch (Exception e) {
            log.warn("Failed to parse EMAIL_SETTING for institute {}: {}", institute.getId(), e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Accepts whatever value the admin dashboard's theme picker writes into
     * {@code institute_theme_code}. The frontend stores either a raw hex (e.g. {@code "#ED7424"})
     * or a CSS color keyword (e.g. {@code "green"}, {@code "blue"}). Both are valid CSS values
     * that email clients render — live-class emails work because they pass the raw value through.
     * The previous version rejected anything that wasn't a 6/7-char hex and fell back to orange,
     * which is why doubt emails showed orange even when the institute had {@code green} set.
     * Only when the column is null/blank do we use the fallback.
     */
    private String normalizeThemeColor(String themeCode) {
        if (themeCode == null || themeCode.trim().isEmpty()) return FALLBACK_THEME_COLOR;
        String t = themeCode.trim();
        if (t.matches("^[0-9A-Fa-f]{6}$")) return "#" + t;  // hex without '#' → normalize
        return t;                                            // hex with '#', CSS keyword, or any valid CSS color → pass through
    }

    /** Strip HTML and truncate for push body / placeholder use. */
    private String summarizeDoubt(Doubts doubt) {
        String html = doubt.getHtmlText();
        if (html == null) return "";
        String text = html.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
        return text.length() > 200 ? text.substring(0, 200) + "…" : text;
    }

    /** Trivial {{var}} substitution. No escaping — templates are trusted admin content. */
    private String applyPlaceholders(String template, Map<String, String> values) {
        if (template == null || template.isEmpty()) return "";
        String out = template;
        for (Map.Entry<String, String> e : values.entrySet()) {
            out = out.replace("{{" + e.getKey() + "}}", e.getValue() == null ? "" : e.getValue());
        }
        return out;
    }

    private String safe(String s) { return s == null ? "" : s; }
    private String safeName(String s) { return (s == null || s.isBlank()) ? "there" : s; }

    /** Immutable per-institute context bundle resolved once per dispatch. */
    private static final class InstituteContext {
        final String instituteName;
        final String themeColor;
        final String fromEmail;
        final String fromName;

        InstituteContext(String instituteName, String themeColor, String fromEmail, String fromName) {
            this.instituteName = instituteName == null ? "" : instituteName;
            this.themeColor = themeColor == null ? FALLBACK_THEME_COLOR : themeColor;
            this.fromEmail = fromEmail == null ? FALLBACK_SUPPORT_EMAIL : fromEmail;
            this.fromName = fromName;
        }
    }

}
