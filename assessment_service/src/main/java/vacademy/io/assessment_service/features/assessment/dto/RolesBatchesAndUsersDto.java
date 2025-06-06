package vacademy.io.assessment_service.features.assessment.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)

public class RolesBatchesAndUsersDto {
    private List<String> batchIds = new ArrayList<>();
    private List<String> roles = new ArrayList<>();
    private List<String> userIds = new ArrayList<>();
    private String accessSetting;
}
