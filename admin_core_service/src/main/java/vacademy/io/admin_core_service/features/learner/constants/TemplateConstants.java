package vacademy.io.admin_core_service.features.learner.constants;

/**
 * TemplateConstants - Holds constant keys used for template configurations,
 * JSON settings, and placeholders across learner features.
 */
public final class TemplateConstants {

    private TemplateConstants() {
        // Prevent instantiation
    }

    // -------------------- Common JSON keys --------------------
    public static final String SETTING = "setting";
    public static final String DATA = "data";
    public static final String ALLOW_UNIQUE_LINK = "allowUniqueLink";
    //free templates
    public static final String FREE_USER_EMAIL_TEMPLATE= "free_user_template";
    public static final String FREE_USER_WHATSAPP_TEMPLATE="free_yoga_meet_template";

    //paid template
    public static final String PAID_USER_EMAIL_TEMPLATE= "paid_user_template";
    public static final String PAID_USER_WHATSAPP_TEMPLATE="paid_yoga_meet_template";

    // -------------------- Welcome Mail --------------------
    public static final String WELCOME_MAIL_SETTING = "WELCOME_MAIL_SETTING";

    // -------------------- WhatsApp Welcome --------------------
    public static final String WHATSAPP_WELCOME_SETTING = "WHATSAPP_WELCOME_SETTING";
    public static final String LANGUAGE_CODE = "languageCode";

    // -------------------- Default values --------------------
    public static final String DEFAULT_LANGUAGE = "en";

    //Learner Dashboard settings
    public static final String LEARNER_DASHBOARD_SETTINGS="LEARNER_DASHBOARD_SETTINGS";
    public static final String LEARNER_DASHBOARD_URL="learner_dashboard_url";


}