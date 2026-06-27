package vacademy.io.community_service.feature.dashboardwidget.enums;

/** Status of a single onboarding-tracker milestone. */
public enum MilestoneStatus {

    NOT_STARTED,
    IN_PROGRESS,
    BLOCKED,
    DONE;

    public static MilestoneStatus fromName(String value) {
        if (value == null) {
            return NOT_STARTED;
        }
        try {
            return MilestoneStatus.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return NOT_STARTED;
        }
    }
}
