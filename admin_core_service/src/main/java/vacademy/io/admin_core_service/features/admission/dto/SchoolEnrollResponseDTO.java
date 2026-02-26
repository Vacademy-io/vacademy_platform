package vacademy.io.admin_core_service.features.admission.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SchoolEnrollResponseDTO {

    private String userId;
    private String userPlanId;
    private List<String> studentFeePaymentIds;
    private String message;
}
