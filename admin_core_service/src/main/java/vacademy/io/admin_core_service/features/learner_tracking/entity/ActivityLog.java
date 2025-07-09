package vacademy.io.admin_core_service.features.learner_tracking.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ConcentrationScoreDTO;

import java.sql.Timestamp;
import java.util.List;

@Entity
@Table(name = "activity_log")
@Getter
@Setter
@NoArgsConstructor
public class ActivityLog {

    @Id
    @Column(length = 255, nullable = false)
    private String id;

    @Column(name = "source_id", length = 255)
    private String sourceId;

    @Column(name = "source_type", length = 255)
    private String sourceType;

    @Column(name = "user_id", length = 255, nullable = false)
    private String userId;

    @Column(name = "slide_id", length = 255)
    private String slideId;

    @Column(name = "start_time")
    private Timestamp startTime;

    @Column(name = "end_time")
    private Timestamp endTime;

    @Column(name = "percentage_watched")
    private Double percentageWatched;

    @Column(name = "created_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp updatedAt;

    @OneToMany(mappedBy = "activityLog", fetch = FetchType.LAZY)
    private List<DocumentTracked> documentTracked;

    @OneToMany(mappedBy = "activityLog", fetch = FetchType.LAZY)
    private List<VideoTracked> videoTracked;

    @OneToMany(mappedBy = "activityLog", fetch = FetchType.LAZY)
    private List<QuestionSlideTracked> questionSlideTracked;

    @OneToMany(mappedBy = "activityLog", fetch = FetchType.LAZY)
    private List<AssignmentSlideTracked> assignmentSlideTracked;

    @OneToMany(mappedBy = "activityLog", fetch = FetchType.LAZY)
    private List<VideoSlideQuestionTracked> videoSlideQuestionTracked;

    @OneToMany(mappedBy = "activityLog", fetch = FetchType.LAZY)
    private List<QuizSlideQuestionTracked> quizSlideQuestionTracked;

    @OneToOne(mappedBy = "activityLog", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    private ConcentrationScore concentrationScore;

    public ActivityLog(ActivityLogDTO activityLogDTO, String userId, String slideId) {
        this.id = activityLogDTO.getId();
        this.sourceId = activityLogDTO.getSourceId();
        this.sourceType = activityLogDTO.getSourceType();
        this.userId = userId;
        this.slideId = slideId;
        if (activityLogDTO.getStartTimeInMillis() != null) {
            this.startTime = new Timestamp(activityLogDTO.getStartTimeInMillis());
        }
        if (activityLogDTO.getEndTimeInMillis() != null) {
            this.endTime = new Timestamp(activityLogDTO.getEndTimeInMillis());
        }
        this.percentageWatched = activityLogDTO.getPercentageWatched();
    }

    public ActivityLogDTO toActivityLogDTO() {
        ActivityLogDTO activityLogDTO = new ActivityLogDTO();

        activityLogDTO.setId(id);
        activityLogDTO.setSourceId(sourceId);
        activityLogDTO.setSourceType(sourceType);
        activityLogDTO.setUserId(userId);
        activityLogDTO.setSlideId(slideId);
        activityLogDTO.setStartTimeInMillis(startTime != null ? startTime.getTime() : null);
        activityLogDTO.setEndTimeInMillis(endTime != null ? endTime.getTime() : null);
        activityLogDTO.setPercentageWatched(percentageWatched != null ? percentageWatched : 0.0);

        activityLogDTO.setDocuments(documentTracked != null
                ? documentTracked.stream()
                .map(DocumentTracked::documentActivityLogDTO)
                .toList()
                : List.of());

        activityLogDTO.setVideos(videoTracked != null
                ? videoTracked.stream()
                .map(VideoTracked::videoActivityLogDTO)
                .toList()
                : List.of());

        activityLogDTO.setAssignmentSlides(assignmentSlideTracked != null
                ? assignmentSlideTracked.stream()
                .map(AssignmentSlideTracked::toAssignmentSlideActivityLog)
                .toList()
                : List.of());

        activityLogDTO.setQuestionSlides(questionSlideTracked != null
                ? questionSlideTracked.stream()
                .map(QuestionSlideTracked::toQuestionSlideActivityLogDTO)
                .toList()
                : List.of());

        activityLogDTO.setVideoSlidesQuestions(videoSlideQuestionTracked != null
                ? videoSlideQuestionTracked.stream()
                .map(VideoSlideQuestionTracked::toVideoSlideQuestionActivityLogDTO)
                .toList()
                : List.of());

        // ---
        // Corrected line
        activityLogDTO.setQuizSides(quizSlideQuestionTracked != null
                ? quizSlideQuestionTracked.stream() // Changed from 'questionSlideTracked'
                .map(QuizSlideQuestionTracked::toQuizSideActivityLogDTO)
                .toList()
                : List.of());
        // ---

        activityLogDTO.setConcentrationScore(concentrationScore != null
                ? concentrationScore.toConcentrationScoreDTO()
                : null);

        return activityLogDTO;
    }

}