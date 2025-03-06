package vacademy.io.assessment_service.features.assessment.dto.export;


import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@Builder
public class LeaderboardExportDto {
    private String ParticipantsName;
    private Integer Rank;
    private Double Marks;
    private String TimeTaken;
    private Double Percentile;
}
