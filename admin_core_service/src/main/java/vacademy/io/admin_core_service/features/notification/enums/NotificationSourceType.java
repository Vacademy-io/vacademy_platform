package vacademy.io.admin_core_service.features.notification.enums;

public enum NotificationSourceType {
    BATCH("batch"),
    PACKAGE("package"),
    USER("user"),
    INSTITUTE("institute"),
    COURSE("course"),
    SESSION("session");

    private final String value;

    NotificationSourceType(String value) {
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


