package vacademy.io.assessment_service.features.assessment.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.Date;


@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public interface ParticipantsDetailsDto {
    String getRegistrationId();
    String getAttemptId();
    String getStudentName();
    Date getAttemptDate();
    Date getAndTime();
    Long getDuration();
    Double getScore();
    String getUserId();
    String getBatchId();
}
