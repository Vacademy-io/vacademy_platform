package vacademy.io.admin_core_service.features.instructor_copilot.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UpdateInstructorCopilotLogRequest {
    private String title;
    private String thumbnailFileId;
    private String transcriptJson;
    private String flashnotesJson;
    private String summary;
    private String questionJson;
    private String flashcardJson;
    private String slidesJson;
    private String videoJson;
    private String status;
    private String packageSessionId;
    private String subjectId;
}
