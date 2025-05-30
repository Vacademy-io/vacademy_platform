package vacademy.io.admin_core_service.features.learner_invitation.dto.json_mapper;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PackageSelectionDTO {
    private boolean instituteAssigned;
    private int maxSelectablePackages;
    private List<PackageDTO> preSelectedPackages;
    private List<PackageDTO> learnerChoicePackages;

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class PackageDTO {
        private boolean instituteAssigned;              // optional, may be absent in learnerChoicePackages
        private int maxSelectableSessions;
        private String name;
        private String id;
        private List<SessionDTO> preSelectedSessionDtos;  // optional, may be absent in learnerChoicePackages
        private List<SessionDTO> learnerChoiceSessions;
    }

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class SessionDTO {
        private boolean instituteAssigned;              // optional, may be absent in learnerChoiceSessions under learnerChoicePackages
        private int maxSelectableLevels;
        private String name;
        private String id;
        private List<LevelDTO> preSelectedLevels;       // optional, may be absent in learnerChoiceSessions
        private List<LevelDTO> learnerChoiceLevels;
    }

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class LevelDTO {
        private String id;
        private String name;
        private String packageSessionId;
    }
}
