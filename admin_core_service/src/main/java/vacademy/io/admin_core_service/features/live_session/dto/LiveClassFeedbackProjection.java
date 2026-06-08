package vacademy.io.admin_core_service.features.live_session.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * One learner's feedback submission for a live-class occurrence, used by the
 * cross-session feedback search. {@code feedbackDetails} and
 * {@code feedbackConfigJson} are raw JSON strings parsed on the frontend (same
 * convention as {@link AttendanceReportProjection#getFeedbackDetails()}).
 * {@code packageSessionIds} is a comma-joined list of the session's batch ids.
 */
public interface LiveClassFeedbackProjection {
    String getFeedbackId();
    String getUserId();
    String getLearnerName();
    String getLearnerEmail();
    String getLearnerMobile();
    String getSessionId();
    String getScheduleId();
    String getSessionTitle();
    String getSubject();
    LocalDate getMeetingDate();
    LocalTime getStartTime();
    String getFeedbackConfigJson();
    String getPackageSessionIds();
    String getFeedbackDetails();
    LocalDateTime getSubmittedAt();
}
