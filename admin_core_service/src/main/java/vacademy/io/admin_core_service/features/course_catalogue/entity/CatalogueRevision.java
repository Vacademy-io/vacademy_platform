package vacademy.io.admin_core_service.features.course_catalogue.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

/**
 * One saved version of a catalogue config. Editors mutate the single DRAFT
 * row per catalogue; Publish promotes it to PUBLISHED and copies its JSON
 * into course_catalogue.catalogue_json (which the learner keeps reading).
 */
@Table(name = "catalogue_revision")
@Entity
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Data
public class CatalogueRevision {
    @UuidGenerator
    @Id
    @Column(name = "id")
    private String id;

    @Column(name = "catalogue_id", nullable = false)
    private String catalogueId;

    @Column(name = "revision_no", nullable = false)
    private Integer revisionNo;

    @Column(name = "catalogue_json", columnDefinition = "TEXT")
    private String catalogueJson;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "source")
    private String source;

    @Column(name = "ai_run_id")
    private String aiRunId;

    @Column(name = "created_by_user_id")
    private String createdByUserId;

    /** Optimistic lock — a stale saveDraft can never flip a just-PUBLISHED
     *  row back to DRAFT (it fails with an optimistic-lock error instead). */
    @Version
    @Column(name = "version")
    private Integer version;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Date updatedAt;
}
