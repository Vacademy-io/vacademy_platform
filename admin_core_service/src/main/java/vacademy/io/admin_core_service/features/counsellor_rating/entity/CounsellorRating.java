package vacademy.io.admin_core_service.features.counsellor_rating.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.sql.Timestamp;

/**
 * Per-(institute, counsellor) cached rating. One row per counsellor per
 * institute (UNIQUE constraint at the DB layer).
 *
 * Migrated from the institute_setting JSON in V327. The strategy CONFIG
 * (window, weights, success-status keys) still lives in the blob — only the
 * per-counsellor SCORES live here. See V327 SQL for the rationale.
 */
@Entity
@Table(
        name = "counsellor_rating",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_counsellor_rating_institute_user",
                columnNames = {"institute_id", "counsellor_user_id"}
        )
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CounsellorRating {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "counsellor_user_id", nullable = false)
    private String counsellorUserId;

    /** Snapshot of the strategy that produced the score: STATIC | STRATEGY_BASED. */
    @Column(name = "strategy_type", nullable = false, length = 32)
    private String strategyType;

    /** 0..100. The effective score callers should read. */
    @Column(name = "score")
    private BigDecimal score;

    /** Component, populated only for STRATEGY_BASED snapshots. */
    @Column(name = "conversion_ratio_score")
    private BigDecimal conversionRatioScore;

    /** Component, populated only for STRATEGY_BASED snapshots. */
    @Column(name = "velocity_score")
    private BigDecimal velocityScore;

    /** Assigned leads observed in the window. NULL for STATIC. */
    @Column(name = "sample_size")
    private Integer sampleSize;

    /**
     * Remembered admin-set value. Survives strategy toggles — the compute
     * service seeds the new snapshot from this on every recompute.
     */
    @Column(name = "manual_override")
    private BigDecimal manualOverride;

    @Column(name = "last_computed_at")
    private Timestamp lastComputedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    @PrePersist
    protected void onPersist() {
        if (updatedAt == null) updatedAt = new Timestamp(System.currentTimeMillis());
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Timestamp(System.currentTimeMillis());
    }
}
