package vacademy.io.admin_core_service.features.student_analysis.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class LearnerOperationSummary {
        private String source; // SLIDE, CHAPTER, MODULE, etc.
        private String operation; // VIDEO_LAST_TIMESTAMP, PERCENTAGE_COMPLETED, etc.
        private String value;
        private String timestamp;
}
