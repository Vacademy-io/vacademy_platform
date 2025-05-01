package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;


@Getter
@Setter
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentReportFilter {
    Map<String, String> sortColumns;
    private String name;
    private List<String> status;
    private List<String> releaseResultStatus;
}
