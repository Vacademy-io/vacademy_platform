package vacademy.io.admin_core_service.features.learner_study_library.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.slide.dto.*;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LearnerSlidesDetailDTO {
    private String id;
    private String sourceId;
    private String sourceType;
    private String title;
    private String imageFileId;
    private String description;
    private String status;
    private Integer slideOrder;
    private VideoSlideDTO videoSlide;
    private DocumentSlideDTO documentSlide;
    private QuestionSlideDTO questionSlide;
    private AssignmentSlideDTO assignmentSlide;
    private QuizSlideDTO quizSlide;
    private HtmlVideoSlideDTO htmlVideoSlide;
    private Double percentageCompleted;
    private Long progressMarker;
    private Object dripCondition;
    private Boolean isLocked;
    private Boolean isHidden;
}
