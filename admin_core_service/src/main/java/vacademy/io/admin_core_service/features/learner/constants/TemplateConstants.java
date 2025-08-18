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
    public static final String TEMPLATE = "template";

    // -------------------- Welcome Mail --------------------
    public static final String WELCOME_MAIL_SETTING = "WELCOME_MAIL_SETTING";

    // -------------------- WhatsApp Welcome --------------------
    public static final String WHATSAPP_WELCOME_SETTING = "WHATSAPP_WELCOME_SETTING";
    public static final String TEMPLATE_NAME = "templateName";
    public static final String LANGUAGE_CODE = "languageCode";

    // -------------------- Default values --------------------
    public static final String DEFAULT_LANGUAGE = "en";

    // -------------------- Placeholders --------------------
    public static final String PLACEHOLDER_NAME = "{name}";
    public static final String PLACEHOLDER_UNIQUE_LINK = "{unique_link}";
}
