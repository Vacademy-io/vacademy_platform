package vacademy.io.assessment_service.features.assessment.dto.export;


import lombok.Builder;

@Builder
public class MarkRankExportDto {
    private Double marks;
    private Integer rank;
    private Integer noOfParticipants;
    private Double percentile;
}
