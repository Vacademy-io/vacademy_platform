package vacademy.io.admin_core_service.features.learner_invitation.dto.json_mapper;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PackageSelectionDTO {

    private String packageId;
    private String packageName;
    private List<SelectedSession> selectedSessions;

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class SelectedSession {
        private String sessionId;
        private String sessionName;
        private List<SelectedLevel> selectedLevels;
    }

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class SelectedLevel {
        private String id;
        private String name;
        private String packageSessionId;
    }
}