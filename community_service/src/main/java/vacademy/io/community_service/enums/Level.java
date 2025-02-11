package vacademy.io.community_service.enums;

public enum Level {
    K12("K-12"),
    HIGHER("Higher Education"),
    CORPORATE("Corporate Training"),
    COMMERCE("Commerce"),
    ARTS("Arts"),
    LAW("Law"),
    MANAGEMENT("Management");

    private final String displayName;

    Level(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
