package vacademy.io.common.meeting.enums;

public enum MeetingProvider {
    ZOHO_MEETING;

    public static MeetingProvider fromString(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Meeting provider name cannot be null or empty");
        }
        try {
            return MeetingProvider.valueOf(name.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unsupported meeting provider: " + name);
        }
    }
}
