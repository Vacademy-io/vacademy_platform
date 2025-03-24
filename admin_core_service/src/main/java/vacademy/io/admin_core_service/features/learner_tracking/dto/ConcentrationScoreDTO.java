package vacademy.io.admin_core_service.features.learner_tracking.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class ConcentrationScoreDTO {
    private String id;
    private Double concentrationScore;
    private int tabSwitchCount;
    private int pauseCount;
    private Integer[] answerTimesInSeconds;
}
