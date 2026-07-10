package vacademy.io.admin_core_service.features.live_session.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * One row per (unique chapter) slide created by the "link recording / material
 * to chapter(s)" teacher flow. Doubles as idempotency guard (schedule_id +
 * recording_id + chapter_id), "already added" UI state, and material history.
 */
@Entity
@Table(name = "live_session_content_links")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LiveSessionContentLink {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "session_id", nullable = false)
    private String sessionId;

    @Column(name = "schedule_id")
    private String scheduleId;

    @Column(name = "recording_id")
    private String recordingId;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "slide_id", nullable = false)
    private String slideId;

    @Column(name = "chapter_id", nullable = false)
    private String chapterId;

    @Column(name = "package_session_id", nullable = false)
    private String packageSessionId;

    @Column(name = "created_by_user_id")
    private String createdByUserId;

    @Column(name = "status")
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
