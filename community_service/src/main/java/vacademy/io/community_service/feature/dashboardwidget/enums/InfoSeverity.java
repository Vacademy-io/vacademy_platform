package vacademy.io.community_service.feature.dashboardwidget.enums;

/** Visual severity of an INFO_CARD widget. */
public enum InfoSeverity {

    INFO,
    WARNING,
    CRITICAL;

    public static InfoSeverity fromName(String value) {
        if (value == null) {
            return INFO;
        }
        try {
            return InfoSeverity.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return INFO;
        }
    }
}
