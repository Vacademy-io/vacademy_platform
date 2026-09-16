package vacademy.io.community_service.feature.trainingvideo.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.util.Date;

/**
 * An LMS training video published by the super admin from the health-check dashboard and
 * played in the admin dashboard's Assist Dock "Training" popup.
 *
 * <p>The video bytes live in S3 (uploaded through media-service, PUBLIC visibility); this row
 * only carries the metadata: name, description and the module-level path the super admin
 * placed it under, e.g. ["LMS","Course creation","AI based course"]. The admin popup renders
 * those segments as a collapsible module tree.
 *
 * <p>Dev/k8s-local profiles run {@code ddl-auto=update} and create the table automatically.
 * Prod/stage have no ddl-auto, so apply this DDL manually there:
 * <pre>
 * CREATE TABLE public.training_video (
 *     id          VARCHAR(255) PRIMARY KEY,
 *     title       VARCHAR(500) NOT NULL,
 *     description TEXT,
 *     file_id     VARCHAR(255),
 *     file_url    VARCHAR(2048) NOT NULL,
 *     module_path JSONB NOT NULL,
 *     active      BOOLEAN NOT NULL DEFAULT TRUE,
 *     created_at  TIMESTAMP,
 *     updated_at  TIMESTAMP
 * );
 * </pre>
 */
@Entity
@Table(name = "training_video", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class TrainingVideo {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "title", length = 500, nullable = false)
    private String title;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    /** media-service (S3) file id, when the video was uploaded through the platform pipeline. */
    @Column(name = "file_id")
    private String fileId;

    /** Public S3 URL the admin popup streams the video from. */
    @Column(name = "file_url", length = 2048, nullable = false)
    private String fileUrl;

    /** jsonb array of 1..3 breadcrumb segments, e.g. ["LMS","Course creation","AI based course"]. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "module_path", columnDefinition = "jsonb", nullable = false)
    private String modulePath;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Date updatedAt;
}
