package vacademy.io.admin_core_service.features.ai_usage.enums;

/**
 * Enum for API provider types.
 * Matches the Python ApiProvider enum.
 */
public enum ApiProvider {
    OPENAI("openai"),
    GEMINI("gemini");

    private final String value;

    ApiProvider(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static ApiProvider fromValue(String value) {
        for (ApiProvider provider : values()) {
            if (provider.value.equalsIgnoreCase(value)) {
                return provider;
            }
        }
        throw new IllegalArgumentException("Unknown API provider: " + value);
    }
}
