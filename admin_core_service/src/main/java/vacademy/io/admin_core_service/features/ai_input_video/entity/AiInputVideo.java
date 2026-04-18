package vacademy.io.admin_core_service.features.ai_input_video.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.sql.Timestamp;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "ai_input_videos")
public class AiInputVideo {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "mode", nullable = false, length = 20)
    private String mode;

    @Column(name = "status", nullable = false, length = 50)
    private String status = "PENDING";

    @Column(name = "source_url", nullable = false, columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(name = "duration_seconds")
    private Float durationSeconds;

    @Column(name = "resolution")
    private String resolution;

    @Column(name = "context_json_url", columnDefinition = "TEXT")
    private String contextJsonUrl;

    @Column(name = "spatial_db_url", columnDefinition = "TEXT")
    private String spatialDbUrl;

    @Column(name = "assets_urls", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String assetsUrls;

    @Column(name = "render_job_id")
    private String renderJobId;

    @Column(name = "progress")
    private Integer progress = 0;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "metadata", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String metadata;

    @Column(name = "created_by_user_id")
    private String createdByUserId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Timestamp createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Timestamp updatedAt;
}
