package vacademy.io.admin_core_service.features.timeline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class TimelineEventRequestDTO {

        @NotBlank(message = "Entity type is required")
        private String type;

        @NotBlank(message = "Entity ID is required")
        private String typeId;

        @NotBlank(message = "Action type is required")
        private String actionType;

        @NotBlank(message = "Title is required")
        private String title;

        private String description;

        private Object metadata; // Arbitrary JSON data
}
