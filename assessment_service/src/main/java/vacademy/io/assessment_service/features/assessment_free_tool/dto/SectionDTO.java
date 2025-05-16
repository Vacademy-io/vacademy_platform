package vacademy.io.assessment_service.features.assessment_free_tool.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class SectionDTO {
    private String id;
    private String name;
    private AssessmentRichTextDataDTO description;
    private Double totalMarks;
    private Double cutOfMarks;
    private Double marksPerQuestion;
    private Integer sectionOrder;
    private List<SectionQuestionsDTO> questions;
    private boolean newSection;
}
