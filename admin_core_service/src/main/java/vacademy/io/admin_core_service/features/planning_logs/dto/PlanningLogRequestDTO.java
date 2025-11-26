package vacademy.io.admin_core_service.features.planning_logs.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
@Getter
@Setter
public class PlanningLogRequestDTO {

        @NotBlank(message = "Log type is required")
        private String logType; // planning, diary_log

        @NotBlank(message = "Entity is required")
        private String entity; // packageSession, etc.

        @NotBlank(message = "Entity ID is required")
        private String entityId;

        @NotBlank(message = "Interval type is required")
        private String intervalType; // daily, weekly, monthly, yearly_month, yearly_quarter

        @NotBlank(message = "Interval type ID is required")
        private String intervalTypeId; // Format varies by interval_type

        @NotBlank(message = "Title is required")
        @Size(max = 255, message = "Title cannot exceed 255 characters")
        private String title;

        private String description;

        @NotBlank(message = "Content HTML is required")
        private String contentHtml; // HTML content

        @NotBlank(message = "Subject ID is required")
        private String subjectId;

        private String commaSeparatedFileIds; // Optional comma-separated file IDs
}
