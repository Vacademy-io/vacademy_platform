package vacademy.io.assessment_service.features.assessment.dto.manual_evaluation;

import lombok.Builder;
import lombok.Data;

import java.util.List;


@Data
@Builder
public class SetOrderDto {
    private String assessmentId;
    private String assessmentName;
    private List<SectionSetOrderDto> sections;
}
