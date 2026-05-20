package vacademy.io.admin_core_service.features.ai_content.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

/**
 * Manifest of "things we can generate from".
 *
 * One row per generation source (a BBB recording, a PDF, a YouTube URL, …).
 * v1 only writes source_type='BBB_RECORDING' rows; the table is intentionally
 * polymorphic so future source types plug in without a schema change.
 *
 * The (source_type, source_id) pair is the natural key — source_id references
 * the id of the source in its owning system (e.g. the BBB recordingId from
 * MeetingRecordingDTO).
 */
@Entity
@Table(name = "ai_content_source")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiContentSource {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    /** v1: 'BBB_RECORDING'. Future: 'PDF', 'YOUTUBE_URL', 'TEXT_NOTES', 'SLIDE_DECK', ... */
    @Column(name = "source_type", nullable = false, length = 64)
    private String sourceType;

    /** Id of the source in its owning system — e.g. the BBB recordingId. */
    @Column(name = "source_id", nullable = false)
    private String sourceId;

    @Column(name = "source_url", columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "created_by")
    private String createdBy;

    /**
     * JSON serialised as TEXT (matches the existing provider_recordings_json
     * pattern in SessionSchedule — service code uses ObjectMapper for
     * read/write). For BBB_RECORDING: { session_schedule_id, file_id,
     * duration_seconds, recording_type }.
     */
    @Column(name = "metadata_json", columnDefinition = "TEXT")
    private String metadataJson;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
