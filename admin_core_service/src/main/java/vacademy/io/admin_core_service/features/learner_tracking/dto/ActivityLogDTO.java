package vacademy.io.admin_core_service.features.learner_tracking.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.admin_core_service.features.slide.dto.QuestionSlideDTO;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Getter
@Setter
public class ActivityLogDTO {
    private String id;
    private String sourceId;
    private String sourceType;
    private String userId;
    private String slideId;
    private Long startTimeInMillis;
    private Long endTimeInMillis;
    private Double percentageWatched;
    private List<VideoActivityLogDTO> videos;
    private List<AudioActivityLogDTO> audios;
    private List<DocumentActivityLogDTO> documents;
    private List<QuestionSlideActivityLogDTO> questionSlides;
    private List<AssignmentSlideActivityLogDTO> assignmentSlides;
    private List<AssessmentSlideActivityLogDTO> assessmentSlides;
    private List<VideoSlideQuestionActivityLogDTO> videoSlidesQuestions;
    private boolean newActivity;
    private ConcentrationScoreDTO concentrationScore;
    private List<QuizSideActivityLogDTO> quizSides;
    private boolean isCertificateCriteriaAchieved;
    private String learnerOperation;

    // ---- Offline sync replay (offline plan, Part A4) ----
    // Server-only, never part of the client HTTP contract (hence @JsonIgnore
    // on both directions -- a malicious/legacy client sending these fields
    // inline must not be able to set them). OfflineSyncEventProcessor is the
    // only writer: it flips offlineReplay for every event it dispatches
    // (LearnerTrackingService/ActivityLogService skip stamping last_seen_at
    // when set) and suppressPositionOps for VIDEO/DOCUMENT events whose
    // clientTs is stale relative to what's already been accepted for this
    // device+slide (LearnerTrackingAsyncService skips the
    // VIDEO_LAST_TIMESTAMP/DOCUMENT_LAST_PAGE last-write-wins write, but
    // still lets the interval-based percentage/engaged-time paths run since
    // those are order-safe).
    @JsonIgnore
    private boolean offlineReplay;
    @JsonIgnore
    private boolean suppressPositionOps;
}