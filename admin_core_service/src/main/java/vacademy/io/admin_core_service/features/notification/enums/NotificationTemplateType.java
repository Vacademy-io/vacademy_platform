package vacademy.io.admin_core_service.features.notification.enums;

public enum NotificationTemplateType {
    EMAIL("EMAIL"),
    WHATSAPP("WHATSAPP"),
    SMS("SMS"),
    PUSH("PUSH");

    private final String value;

    NotificationTemplateType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    @Override
    public String toString() {
        return value;
    }
}


