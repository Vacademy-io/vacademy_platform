package vacademy.io.community_service.feature.session.dto.admin;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.HashMap;
import java.util.Map;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class CreateSessionDto {
    private String source;
    private String sourceId;
    private Boolean canJoinInBetween = true;
    private Boolean showResultsAtLastSlide = true;
    private Boolean allowLearnerHandRaise = true;
    private Boolean isSessionRecorded = true;
    private Boolean allowChat = true;
    private Integer defaultSecondsForQuestion = 60;
    private Integer studentAttempts = 1;
}