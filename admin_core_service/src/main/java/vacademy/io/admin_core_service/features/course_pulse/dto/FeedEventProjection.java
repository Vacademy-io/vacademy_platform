package vacademy.io.admin_core_service.features.course_pulse.dto;

/**
 * One recent event for the Live Feed, unioned across the submission/attempt tables
 * by created/submitted time. The stream is inherently bounded by the time window and
 * a row limit, so it does not need the presence columns.
 */
public interface FeedEventProjection {
    /** epoch millis of the event, for client-side ordering/formatting. */
    Long getOccurredAtEpoch();
    String getUserId();
    String getFullName();
    String getSlideId();
    String getSlideTitle();
    String getSlideType();

    /** SUBMITTED_ASSIGNMENT | SUBMITTED_ASSESSMENT | CODE_SUBMISSION | ANSWERED_QUESTION | ANSWERED_QUIZ */
    String getEventType();

    /** short human detail, e.g. a coding verdict or answer status (may be null). */
    String getDetail();
}
