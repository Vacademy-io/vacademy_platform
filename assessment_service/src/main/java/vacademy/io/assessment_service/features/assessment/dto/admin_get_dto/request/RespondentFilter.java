package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.request;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.List;
import java.util.Map;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class RespondentFilter {
    private String name;
    private String status;
    private String assessmentType;
    private List<String> batches;
    private Map<String, String> sortColumns;
}
