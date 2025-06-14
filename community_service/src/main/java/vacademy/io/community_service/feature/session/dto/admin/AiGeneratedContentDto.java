package vacademy.io.community_service.feature.session.dto.admin;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true) // To prevent errors if the AI adds extra fields
public class AiGeneratedContentDto {
    private String htmlSummary;
    private List<String> htmlActionPoints;
    private String adminComment;
}
