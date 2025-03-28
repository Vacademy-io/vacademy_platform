package vacademy.io.assessment_service.features.assessment.dto.manual_evaluation;


import lombok.Builder;
import lombok.Data;

@Builder
@Data
public class UserEvaluationSettingDto {
    private String userId;
    private String name;
    private String email;
    private Double percentage;
    private String role;
}
