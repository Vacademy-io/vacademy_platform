package vacademy.io.assessment_service.features.assessment.dto.manual_evaluation;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EvaluationSettingDto {
    private String instituteId;
    private String assessmentId;
    private String type;
    private List<UserEvaluationSettingDto> users;
}
