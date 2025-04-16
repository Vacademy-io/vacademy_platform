package vacademy.io.assessment_service.features.assessment_free_tool.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.BasicAssessmentDetailsDTO;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class FullAssessmentDTO {
    private BasicAssessmentDetailsDTO basicDetails;
    private List<SectionDTO> sections;
}
