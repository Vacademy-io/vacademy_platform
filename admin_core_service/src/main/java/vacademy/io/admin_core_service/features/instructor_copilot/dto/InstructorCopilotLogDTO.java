package vacademy.io.admin_core_service.features.instructor_copilot.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.instructor_copilot.entity.InstructorCopilotLog;

import java.sql.Timestamp;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstructorCopilotLogDTO {
    private String id;
    private String createdByUserId;
    private String instituteId;
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
    private Timestamp createdAt;
    private Timestamp updatedAt;

    public InstructorCopilotLogDTO(InstructorCopilotLog log) {
        this.id = log.getId();
        this.createdByUserId = log.getCreatedByUserId();
        this.instituteId = log.getInstituteId();
        this.title = log.getTitle();
        this.thumbnailFileId = log.getThumbnailFileId();
        this.transcriptJson = log.getTranscriptJson();
        this.flashnotesJson = log.getFlashnotesJson();
        this.summary = log.getSummary();
        this.questionJson = log.getQuestionJson();
        this.flashcardJson = log.getFlashcardJson();
        this.slidesJson = log.getSlidesJson();
        this.videoJson = log.getVideoJson();
        this.status = log.getStatus();
        this.packageSessionId = log.getPackageSessionId();
        this.subjectId = log.getSubjectId();
        this.createdAt = log.getCreatedAt();
        this.updatedAt = log.getUpdatedAt();
    }
}
