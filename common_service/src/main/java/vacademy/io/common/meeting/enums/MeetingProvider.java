package vacademy.io.common.meeting.enums;

public enum MeetingProvider {
    ZOHO_MEETING,
    BBB_MEETING,
    ZOOM_MEETING,
    GOOGLE_MEET;

    public static MeetingProvider fromString(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Meeting provider name cannot be null or empty");
        }
        try {
            String clean = name.trim().toUpperCase();
            if (clean.equals("ZOHO"))
                return ZOHO_MEETING;
            if (clean.equals("BBB"))
                return BBB_MEETING;
            if (clean.equals("ZOOM"))
                return ZOOM_MEETING;
            if (clean.equals("GOOGLE") || clean.equals("GMEET")
                    || clean.equals("GOOGLE_MEET") || clean.equals("GOOGLEMEET")
                    || clean.equals("GOOGLE MEET")) // wizard persists link_type "google meet"
                return GOOGLE_MEET;
            return MeetingProvider.valueOf(clean);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unsupported meeting provider: " + name);
        }
    }
}
