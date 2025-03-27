package vacademy.io.assessment_service.features.assessment.dto.manual_evaluation;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class SectionSetOrderDto {
    private String sectionId;
    private Integer order;
    private List<QuestionSetOrderDto> questions;
}
