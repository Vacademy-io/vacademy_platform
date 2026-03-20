package vacademy.io.community_service.feature.session.dto.admin;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeaderboardEntryDto {
    private int rank;
    private String username;
    private double totalScore;
    private long totalTimeMillis;
    private int correctCount;
    private int wrongCount;
    private int unansweredCount;
    private int totalMcqQuestions;
}
