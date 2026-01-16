package vacademy.io.admin_core_service.features.learner_tracking.dto;

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
    private List<VideoSlideQuestionActivityLogDTO> videoSlidesQuestions;
    private boolean newActivity;
    private ConcentrationScoreDTO concentrationScore;
    private List<QuizSideActivityLogDTO> quizSides;
    private boolean isCertificateCriteriaAchieved;
    private String learnerOperation;
}