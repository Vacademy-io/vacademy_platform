package vacademy.io.admin_core_service.features.doubts.manager;

/**
 * Canonical names for the two default doubt-notification email templates.
 *
 * <p>Templates are looked up by {@code (institute_id, name, type='EMAIL')} via
 * {@link vacademy.io.admin_core_service.features.institute.repository.TemplateRepository#findByInstituteIdAndNameAndType}
 * in {@link DoubtNotificationService#resolveTemplateId}. The HTML/subject content lives only in
 * the Flyway migrations:
 *   - V214 originally seeded per-institute copies (deprecated; V215 cleans them up).
 *   - V215 consolidates to a single global row at {@code institute_id = 'DEFAULT'}.
 *
 * <p>If you need to change template copy, add a new migration that UPDATEs the row(s) — don't
 * edit V214/V215 retroactively (Flyway checksum lock).
 */
public final class DoubtNotificationTemplateDefaults {

    private DoubtNotificationTemplateDefaults() {}

    public static final String RAISED_TEMPLATE_NAME = "Doubt Raised - Teacher Notification";
    public static final String RESOLVED_TEMPLATE_NAME = "Doubt Resolved - Learner Notification";
    /** Staff reply emailed to a logged-out guest (their only channel). Seeded by V332. */
    public static final String GUEST_REPLY_TEMPLATE_NAME = "Doubt Reply - Guest Notification";
}
