package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public interface RespondentListDto {
    String getRegistrationId();

    String getUserId();

    String getParticipantName();

    String getAttemptId();

    Long getResponseTimeInSeconds();

    String getSource();

    String getSourceId();

    String getStatus();
}
