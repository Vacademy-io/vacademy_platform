package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for Package Suggestions in Autocomplete
 */
@Data
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class PackageSuggestionDTO {
    private String packageId;
    private String packageName;
    private String packageSessionId;
    private String levelId;
    private String levelName;
    private String sessionId;
    private String sessionName;

    public PackageSuggestionDTO(String packageId, String packageName, String packageSessionId, String levelId,
            String levelName, String sessionId, String sessionName) {
        this.packageId = packageId;
        this.packageName = packageName;
        this.packageSessionId = packageSessionId;
        this.levelId = levelId;
        this.levelName = levelName;
        this.sessionId = sessionId;
        this.sessionName = sessionName;
    }
}
