package vacademy.io.admin_core_service.features.enrollment_policy.constants;

/**
 * Constants for enrollment policy email templates.
 * Contains default templates used when custom templates are not found.
 */
public class EnrollmentTemplateConstants {

    /**
     * Default email template body for expiry notifications.
     * Used when no custom template is found in the Templates table.
     */
    public static final String DEFAULT_EXPIRY_TEMPLATE_BODY = "<html><body>" +
            "<p>Hi {{learner_name}},</p>" +
            "<p>Your access to {{course_name}} has expired on {{expiry_date}}.</p>" +
            "<p>To continue learning, please renew your subscription: <a href=\"{{renewal_link}}\">Renew Now</a></p>" +
            "<p>Thank you!</p>" +
            "</body></html>";

    /**
     * Default email template subject for expiry notifications.
     * Used when no custom template is found in the Templates table.
     */
    public static final String DEFAULT_EXPIRY_TEMPLATE_SUBJECT = "Your Access to {{course_name}} has Expired";

    /**
     * Default renewal link (hardcoded for now).
     * TODO: Replace with actual renewal link generation logic.
     */
    public static final String DEFAULT_RENEWAL_LINK = "https://vacademy.io/renew";

    private EnrollmentTemplateConstants() {
        // Utility class - prevent instantiation
    }
}

