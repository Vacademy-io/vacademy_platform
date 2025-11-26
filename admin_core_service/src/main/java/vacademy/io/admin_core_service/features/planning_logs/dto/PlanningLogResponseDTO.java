package vacademy.io.admin_core_service.features.planning_logs.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.sql.Timestamp;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlanningLogResponseDTO {

        private String id;
        private String createdByUserId;
        private String logType;
        private String entity;
        private String entityId;
        private String intervalType;
        private String intervalTypeId;
        private String title;
        private String description;
        private String contentHtml;
        private String subjectId;
        private String commaSeparatedFileIds;
        private String status;
        private String instituteId;
        private Timestamp createdAt;
        private Timestamp updatedAt;
}
