package vacademy.io.admin_core_service.features.learner_tracking.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ProcessedActivityLogItem {
        private String id;
        private String userId;
        private String slideId;
        private String sourceId;
        private String sourceType;
        private String status;
        private String processedJson;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
}
