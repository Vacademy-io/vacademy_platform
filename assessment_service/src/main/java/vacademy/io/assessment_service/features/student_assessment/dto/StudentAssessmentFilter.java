package vacademy.io.assessment_service.features.student_assessment.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentAssessmentFilter {
    private String name;
    private List<String> batchIds;
    private List<String> tagIds;
    private Boolean getLiveAssessments;
    private Boolean getPassedAssessments;
    private Boolean getUpcomingAssessments;
    private List<String> instituteIds = new ArrayList<>();
    private Map<String, String> sortColumns = new HashMap<>();
}