package vacademy.io.admin_core_service.features.learner_study_library.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.slide.dto.AssignmentSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.DocumentSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.QuestionSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.VideoSlideDTO;

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
    private Double percentageCompleted;
    private Long progressMarker;
}
