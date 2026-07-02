package vacademy.io.community_service.feature.dashboardwidget.enums;

/** Lifecycle of a widget. Only PUBLISHED widgets are returned to institute dashboards. */
public enum WidgetStatus {

    DRAFT,
    PUBLISHED,
    ARCHIVED;

    public static WidgetStatus fromName(String value) {
        if (value == null) {
            return DRAFT;
        }
        try {
            return WidgetStatus.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return DRAFT;
        }
    }
}
