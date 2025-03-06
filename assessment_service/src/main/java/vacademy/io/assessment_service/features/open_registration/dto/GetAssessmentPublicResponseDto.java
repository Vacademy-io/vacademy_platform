package vacademy.io.assessment_service.features.open_registration.dto;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import org.springframework.context.annotation.Primary;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentCustomField;
import vacademy.io.assessment_service.features.assessment.service.creation.AssessmentBasicDetail;

import java.util.Date;
import java.util.HashSet;
import java.util.Set;

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
    private Date serverTimeInGmt;
    private Set<AssessmentCustomField> assessmentCustomFields = new HashSet<>();
}
