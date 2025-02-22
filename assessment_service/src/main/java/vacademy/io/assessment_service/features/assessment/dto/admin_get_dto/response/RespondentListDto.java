package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class RespondentListDto {
    private String userId;
    private String participantName;
    private String batchId;
    private String enrollmentNumber;
    private Long responseTime;
}
