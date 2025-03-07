package vacademy.io.assessment_service.features.assessment.dto.export;

import lombok.Builder;

@Builder
public class RespondentExportDto {
    private String participantName;
    private String responseTime;
    private String status;
}
