package vacademy.io.community_service.feature.dashboardwidget.enums;

/** How a widget is targeted: a single institute, or every institute carrying a lead tag. */
public enum WidgetTargetType {

    INSTITUTE,
    LEAD_TAG;

    public static WidgetTargetType fromName(String value) {
        if (value == null) {
            return INSTITUTE;
        }
        try {
            return WidgetTargetType.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return INSTITUTE;
        }
    }
}
