package vacademy.io.admin_core_service.features.student_analysis.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentReportData {
    private String learningFrequency; // markdown
    private String progress; // markdown
    private String topicsOfImprovement; // markdown
    private String topicsOfDegradation; // markdown
    private String remedialPoints; // markdown
    private Map<String, Integer> strengths; // topic -> percentage
    private Map<String, Integer> weaknesses; // topic -> percentage
}
