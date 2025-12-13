package vacademy.io.admin_core_service.features.instructor_copilot.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.sql.Timestamp;

@Entity
@Table(name = "instructor_copilot_logs")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstructorCopilotLog {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "created_by_user_id", nullable = false)
    private String createdByUserId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "title")
    private String title;

    @Column(name = "thumbnail_file_id")
    private String thumbnailFileId;

    @Column(name = "transcript_json", columnDefinition = "TEXT")
    private String transcriptJson;

    @Column(name = "flashnotes_json", columnDefinition = "TEXT")
    private String flashnotesJson;

    @Column(name = "summary", columnDefinition = "TEXT")
    private String summary;

    @Column(name = "question_json", columnDefinition = "TEXT")
    private String questionJson;

    @Column(name = "flashcard_json", columnDefinition = "TEXT")
    private String flashcardJson;

    @Column(name = "slides_json", columnDefinition = "TEXT")
    private String slidesJson;

    @Column(name = "video_json", columnDefinition = "TEXT")
    private String videoJson;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Timestamp createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Timestamp updatedAt;
}
