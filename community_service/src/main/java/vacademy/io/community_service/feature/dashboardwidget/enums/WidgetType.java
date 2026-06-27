package vacademy.io.community_service.feature.dashboardwidget.enums;

/** The kind of widget rendered on an institute admin's dashboard. */
public enum WidgetType {

    /** Implementation/onboarding tracker — milestones with status + ETA, institute can comment/confirm. */
    ONBOARDING_TRACKER,

    /** Announcement / maintenance notice — severity-styled card with optional image + CTA. */
    INFO_CARD;

    public static WidgetType fromName(String value) {
        if (value == null) {
            return null;
        }
        try {
            return WidgetType.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
