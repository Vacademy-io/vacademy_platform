package vacademy.io.admin_core_service.features.planning_logs.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
@Getter
@Setter
public class PlanningLogUpdateDTO {

        private String title;
        private String description;
        private String contentHtml;
        private String commaSeparatedFileIds;
        private String status; // Can be set to "DELETED" to mark as deleted
        private Boolean isSharedWithStudent;
}
