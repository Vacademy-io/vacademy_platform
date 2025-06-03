package vacademy.io.community_service.feature.session.dto.participant;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ParticipantResponseDto {
    private String username;
    private Long timeToResponseMillis;
    private Long submittedAt; // Server timestamp when response was recorded
    private SubmittedResponseDataDto responseData;
}