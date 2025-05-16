package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class SlideDTO {
    private String id;
    private String sourceId;
    private String sourceType;
    private String title;
    private String imageFileId;
    private String description;
    private String status;
    private Integer slideOrder;
    private boolean isNewSlide;
    private VideoSlideDTO videoSlide;
    private DocumentSlideDTO documentSlide;
    private QuestionSlideDTO questionSlide;
    private AssignmentSlideDTO assignmentSlide;
    private Boolean isLoaded = false;
}
