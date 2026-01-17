package vacademy.io.notification_service.constants;

public class NotificationConstants {
    private NotificationConstants() {
    } // prevent instantiation

    // Common JSON keys
    public static final String SETTING = "setting";
    public static final String EMAIL_SETTING = "EMAIL_SETTING";
    public static final String DATA = "data";
    public static final String UTILITY_EMAIL = "UTILITY_EMAIL";

    // Email fields
    public static final String FROM = "from";
    public static final String HOST = "host";
    public static final String PORT = "port";
    public static final String USERNAME = "username";
    public static final String PASSWORD = "password";

    // WhatsApp constants
    public static final String WHATSAPP_SETTING = "WHATSAPP_SETTING";
    public static final String UTILITY_WHATSAPP = "UTILITY_WHATSAPP";
    public static final String APP_ID = "appId";
    public static final String ACCESS_TOKEN = "accessToken";

    // WhatsApp Provider constants
    public static final String PROVIDER = "provider";
    public static final String WATI = "wati";
    public static final String META = "meta";
    public static final String COMBOT = "combot";
    public static final String API_KEY = "apiKey";
    public static final String API_URL = "apiUrl";
    public static final String PHONE_NUMBER_ID = "phone_number_id";
    public static final String WHATSAPP_NUMBER = "whatsappNumber";
    // Testing allowlist for WhatsApp sending
    public static final String TEST_PHONE_NUMBER = "TEST_PHONE_NUMBER";
    public static final String FLAG = "flag";

    // OTP Type constants
    public static final String OTP_TYPE_EMAIL = "EMAIL";
    public static final String OTP_TYPE_WHATSAPP = "WHATSAPP";

    // OTP Service Type constants
    public static final String OTP_SERVICE_EMAIL_AUTH = "EMAIL_AUTH";
    public static final String OTP_SERVICE_WHATSAPP_AUTH = "WHATSAPP_AUTH";
}
