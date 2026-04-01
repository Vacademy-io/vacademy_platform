package vacademy.io.assessment_service.features.learner_assessment.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import vacademy.io.assessment_service.features.assessment.dto.LeaderBoardDto;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Builder
public class SmartLeaderboardDto {
    private List<LeaderBoardDto> topRanks;
    private List<LeaderBoardDto> surroundingRanks;
    private boolean hasGap;
    private Integer studentRank;
    private Long totalParticipants;
}
