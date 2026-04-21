package vacademy.io.admin_core_service.features.doubts.manager;

/**
 * Canonical copy of the HTML + subject for the two default doubt-notification email templates.
 *
 * <p>Two seed paths reference these constants:
 * <ul>
 *   <li>{@code V214__Seed_Doubt_Notification_Email_Templates.sql} — backfills existing institutes
 *       at deploy time. Its HTML is a copy of what lives here.</li>
 *   <li>{@link vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService}
 *       — seeds new institutes at creation time via
 *       {@code createDefaultSettingsForInstitute}, using these constants directly.</li>
 * </ul>
 *
 * <p>Branding is NOT hardcoded. Placeholders ({@code {{institute_theme_color}}},
 * {@code {{institute_name}}}, {@code {{support_email}}}, per-doubt fields) are substituted at send
 * time by {@link DoubtNotificationService#applyPlaceholders}.
 *
 * <p>If you change a template here, also:
 *   <ol>
 *     <li>mirror the edit into V214 (or add a follow-up migration that UPDATEs existing rows),</li>
 *     <li>decide whether to re-seed institutes whose admins have already edited the DB row — by
 *         default we do NOT overwrite, so manual edits survive.</li>
 *   </ol>
 */
public final class DoubtNotificationTemplateDefaults {

    private DoubtNotificationTemplateDefaults() {}

    /**
     * Templates are looked up by {@code (institute_id, name, type='EMAIL')}. The id column is
     * a random UUID assigned at insert time — don't try to derive it from anything.
     */
    public static final String RAISED_TEMPLATE_NAME = "Doubt Raised - Teacher Notification";
    public static final String RESOLVED_TEMPLATE_NAME = "Doubt Resolved - Learner Notification";

    public static final String RAISED_SUBJECT =
            "New doubt raised on {{institute_name}} - please review";

    public static final String RAISED_HTML =
            "<!DOCTYPE html>\n"
            + "<html><head><meta charset=\"UTF-8\"><title>New doubt raised</title></head>\n"
            + "<body style=\"margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f6f8;color:#1f2937;\">\n"
            + "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f4f6f8;padding:24px 0;\"><tr><td align=\"center\">\n"
            + "<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);\">\n"
            + "<tr><td style=\"background:{{institute_theme_color}};color:#ffffff;padding:20px 28px;\">\n"
            + "<p style=\"margin:0;font-size:12px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;opacity:0.85;\">{{institute_name}}</p>\n"
            + "<h1 style=\"margin:6px 0 0;font-size:20px;font-weight:600;\">New doubt raised</h1>\n"
            + "<p style=\"margin:4px 0 0;font-size:13px;opacity:0.9;\">A learner is waiting for your help.</p></td></tr>\n"
            + "<tr><td style=\"padding:28px;\">\n"
            + "<p style=\"margin:0 0 16px;font-size:15px;\">Hi {{recipient_name}},</p>\n"
            + "<p style=\"margin:0 0 16px;font-size:14px;line-height:1.5;\">A new doubt has been raised on one of your batches and you've been assigned to resolve it.</p>\n"
            + "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;\"><tr><td style=\"padding:16px 20px;\">\n"
            + "<p style=\"margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;\">Doubt</p>\n"
            + "<p style=\"margin:0;font-size:14px;line-height:1.5;color:#111827;\">{{doubt_text}}</p></td></tr></table>\n"
            + "<p style=\"margin:16px 0 8px;font-size:13px;color:#6b7280;\"><strong style=\"color:#374151;\">Batch:</strong> {{batch_id}}<br><strong style=\"color:#374151;\">Doubt ID:</strong> {{doubt_id}}</p>\n"
            + "<div style=\"margin:28px 0 8px;\"><a href=\"#\" style=\"display:inline-block;background:{{institute_theme_color}};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;\">Open doubt</a></div>\n"
            + "<p style=\"margin:24px 0 0;font-size:12px;color:#9ca3af;\">You're receiving this because {{institute_name}} enabled email alerts for new doubts. Questions? Write to <a href=\"mailto:{{support_email}}\" style=\"color:#6b7280;\">{{support_email}}</a>.</p>\n"
            + "</td></tr></table></td></tr></table></body></html>";

    public static final String RESOLVED_SUBJECT =
            "Your doubt on {{institute_name}} has been resolved";

    public static final String RESOLVED_HTML =
            "<!DOCTYPE html>\n"
            + "<html><head><meta charset=\"UTF-8\"><title>Your doubt was resolved</title></head>\n"
            + "<body style=\"margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f6f8;color:#1f2937;\">\n"
            + "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f4f6f8;padding:24px 0;\"><tr><td align=\"center\">\n"
            + "<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);\">\n"
            + "<tr><td style=\"background:{{institute_theme_color}};color:#ffffff;padding:20px 28px;\">\n"
            + "<p style=\"margin:0;font-size:12px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;opacity:0.85;\">{{institute_name}}</p>\n"
            + "<h1 style=\"margin:6px 0 0;font-size:20px;font-weight:600;\">Your doubt was resolved ✓</h1>\n"
            + "<p style=\"margin:4px 0 0;font-size:13px;opacity:0.9;\">A teacher has replied.</p></td></tr>\n"
            + "<tr><td style=\"padding:28px;\">\n"
            + "<p style=\"margin:0 0 16px;font-size:15px;\">Hi {{recipient_name}},</p>\n"
            + "<p style=\"margin:0 0 16px;font-size:14px;line-height:1.5;\">Good news — your doubt on {{institute_name}} has been resolved. Open it in the app to see the reply from your teacher.</p>\n"
            + "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;\"><tr><td style=\"padding:16px 20px;\">\n"
            + "<p style=\"margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;\">Your original doubt</p>\n"
            + "<p style=\"margin:0;font-size:14px;line-height:1.5;color:#111827;\">{{doubt_text}}</p></td></tr></table>\n"
            + "<p style=\"margin:16px 0 8px;font-size:13px;color:#6b7280;\"><strong style=\"color:#374151;\">Doubt ID:</strong> {{doubt_id}}</p>\n"
            + "<div style=\"margin:28px 0 8px;\"><a href=\"#\" style=\"display:inline-block;background:{{institute_theme_color}};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;\">See the reply</a></div>\n"
            + "<p style=\"margin:24px 0 0;font-size:12px;color:#9ca3af;\">If you still have follow-up questions, you can reply on the same doubt thread inside the app. Need help? Write to <a href=\"mailto:{{support_email}}\" style=\"color:#6b7280;\">{{support_email}}</a>.</p>\n"
            + "</td></tr></table></td></tr></table></body></html>";
}
