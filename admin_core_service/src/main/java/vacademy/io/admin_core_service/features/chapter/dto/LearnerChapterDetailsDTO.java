package vacademy.io.admin_core_service.features.chapter.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class LearnerChapterDetailsDTO {
    private String id;
    private String chapterName;
    private String status;
    private String fileId;
    private String description;
    private Double percentageCompleted;
    private String lastSlideViewed;
    private Integer videoCount;
    private Integer pdfCount;
    private Integer docCount;
    private Integer questionSlideCount;
    private Integer assignmentSlideCount;
    private Integer surveySlideCount;
    private Integer unknownCount;
}


