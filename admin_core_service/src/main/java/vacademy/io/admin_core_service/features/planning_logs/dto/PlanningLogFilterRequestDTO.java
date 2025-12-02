package vacademy.io.admin_core_service.features.planning_logs.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
@Getter
@Setter
public class PlanningLogFilterRequestDTO {

        private List<String> intervalTypes;
        private List<String> intervalTypeIds;
        private List<String> createdByUserIds;
        private List<String> logTypes;
        private List<String> entityIds; // packageSession IDs
        private List<String> subjectIds;
        private List<String> statuses;
        private Boolean isSharedWithStudent;
}
