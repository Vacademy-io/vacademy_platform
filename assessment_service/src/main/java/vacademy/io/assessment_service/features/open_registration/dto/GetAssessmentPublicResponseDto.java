package vacademy.io.assessment_service.features.open_registration.dto;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.assessment_service.features.assessment.service.creation.AssessmentBasicDetail;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@AllArgsConstructor
@Builder
public class GetAssessmentPublicResponseDto {
    private String instituteId;
    private AssessmentPublicDto assessmentPublicDto;
    private Boolean canRegister;
    private String errorMessage;
}
