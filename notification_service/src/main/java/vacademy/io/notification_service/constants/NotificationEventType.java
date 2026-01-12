package vacademy.io.notification_service.constants;

/**
 * Defines the types of notification events that can trigger template-based
 * messages
 * These event names must match the event_name column in
 * notification_event_config table
 */
public enum NotificationEventType {
    /**
     * OTP request event for authentication
     * Used for: WhatsApp OTP, Email OTP
     */
    OTP_REQUEST("OTP_REQUEST"),

    /**
     * Learner enrollment event
     * Used for: Welcome emails, enrollment confirmations
     */
    LEARNER_ENROLL("LEARNER_ENROLL"),

    /**
     * Referral invitation event
     * Used for: Referral invitation emails/messages
     */
    REFERRAL_INVITATION("REFERRAL_INVITATION"),

    /**
     * Audience form submission event
     * Used for: Form submission confirmations
     */
    AUDIENCE_FORM_SUBMISSION("AUDIENCE_FORM_SUBMISSION");

    private final String eventName;

    NotificationEventType(String eventName) {
        this.eventName = eventName;
    }

    /**
     * Get the event name as stored in the database
     * 
     * @return Event name string
     */
    public String getEventName() {
        return eventName;
    }

    /**
     * Get enum from event name string
     * 
     * @param eventName Event name from database
     * @return NotificationEventType enum
     */
    public static NotificationEventType fromEventName(String eventName) {
        for (NotificationEventType type : values()) {
            if (type.eventName.equals(eventName)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown event name: " + eventName);
    }
}
