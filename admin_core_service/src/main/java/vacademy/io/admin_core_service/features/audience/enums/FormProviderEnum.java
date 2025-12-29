package vacademy.io.admin_core_service.features.audience.enums;

/**
 * Enum representing different form providers for webhook integrations
 */
public enum FormProviderEnum {
    ZOHO_FORMS("ZOHO_FORMS", "Zoho Forms"),
    GOOGLE_FORMS("GOOGLE_FORMS", "Google Forms"),
    MICROSOFT_FORMS("MICROSOFT_FORMS", "Microsoft Forms");

    private final String code;
    private final String displayName;

    FormProviderEnum(String code, String displayName) {
        this.code = code;
        this.displayName = displayName;
    }

    public String getCode() {
        return code;
    }

    public String getDisplayName() {
        return displayName;
    }

    public static FormProviderEnum fromCode(String code) {
        for (FormProviderEnum provider : values()) {
            if (provider.code.equalsIgnoreCase(code)) {
                return provider;
            }
        }
        throw new IllegalArgumentException("Unknown form provider: " + code);
    }
}
