package vacademy.io.community_service.feature.session.dto.admin;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.community_service.feature.session.dto.participant.SubmittedResponseDataDto;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AdminSlideResponseViewDto {
    private String username;
    private Long timeToResponseMillis;
    private Long submittedAt;
    private SubmittedResponseDataDto responseData;
    private Boolean isCorrect; // Can be null if not evaluable
}