package vacademy.io.admin_core_service.features.enroll_invite.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class EnrollInviteFilterDTO {
    private String searchName;
    private List<String> packageSessionIds;
    private List<String>paymentOptionIds;
    private Map<String, String> sortColumns;
    private List<String>tags;
}
