package vacademy.io.notification_service.features.combot.constants;

/**
 * General constants for Com.bot integration
 */
public final class CombotConstants {

    public static final String ERROR_CODE_UNKNOWN = "unknown";
    public static final Object DEFAULT_FALLBACK_INSTITUTE_NAME = "vacademy";

    // Private constructor to prevent instantiation
    private CombotConstants() {
        throw new UnsupportedOperationException("This is a utility class and cannot be instantiated");
    }

    // ========== Source Identifiers ==========
    public static final String SOURCE_COMBOT = "COMBOT";
    public static final String SOURCE_WEB_CLIENT = "WEB_CLIENT";

    
    // ========== Default Values ==========
    public static final String DEFAULT_TEMPLATE = "none";
    public static final String UNKNOWN_TEMPLATE = "unknown";
    public static final String ANONYMOUS_USER = "anonymous";
    public static final String DEFAULT_FALLBACK_NAME = "Student";


    // ========== Thread Delays (milliseconds) ==========
    public static final int DELAY_BETWEEN_MESSAGES = 100;
    public static final int DELAY_BETWEEN_AUTO_REPLIES = 200;
    
    // ========== Field Keys for Variable Resolution ==========
    public static final String FIELD_MOBILE_NUMBER = "mobile_number";
    public static final String FIELD_PHONE = "phone";
    public static final String FIELD_INSTITUTE_NAME = "institute_name";
    public static final String FIELD_CUSTOM_FIELDS = "custom_fields";
    
    // ========== URL Patterns ==========
    public static final String ADMIN_CORE_USER_BY_PHONE_PATH = "/admin-core-service/internal/user/by-phone?phoneNumber=";
    
    // ========== Notification Type Max Length ==========
    public static final int NOTIFICATION_TYPE_MAX_LENGTH = 20;
    
    // ========== Language Codes ==========
    public static final String DEFAULT_LANGUAGE_CODE = "en";
}
