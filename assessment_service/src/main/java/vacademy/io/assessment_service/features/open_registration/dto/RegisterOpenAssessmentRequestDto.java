package vacademy.io.assessment_service.features.open_registration.dto;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.common.student.dto.BasicParticipantDTO;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@AllArgsConstructor
@Builder
public class RegisterOpenAssessmentRequestDto {
    private String instituteId;
    private String assessmentId;
    private BasicParticipantDTO participantDTO;
}
