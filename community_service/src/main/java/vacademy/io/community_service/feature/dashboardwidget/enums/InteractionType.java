package vacademy.io.community_service.feature.dashboardwidget.enums;

/** An institute-side action on a widget. */
public enum InteractionType {

    /** Free-text comment, optionally scoped to a milestone. */
    COMMENT,

    /** Institute admin confirms/acknowledges a milestone. */
    CONFIRM;

    public static InteractionType fromName(String value) {
        if (value == null) {
            return null;
        }
        try {
            return InteractionType.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
