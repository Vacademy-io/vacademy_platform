package vacademy.io.admin_core_service.features.engagement.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;

/**
 * The prompt that grows: base_text is IMMUTABLE (the admin's original brief), each edit
 * appends a delta, compiled_text is deterministically assembled (base + deltas in order).
 * Never re-summarize with an LLM — that is drift-by-resummarization, and after six edits
 * the engine runs something nobody wrote.
 */
@Entity
@Table(name = "engagement_prompt_version")
@Getter
@Setter
public class EngagementPromptVersion {

    @Id
    @Column(length = 255, nullable = false)
    @UuidGenerator
    private String id;

    @Column(name = "engine_id", nullable = false)
    private String engineId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(nullable = false)
    private Integer version;

    @Column(name = "base_text", columnDefinition = "TEXT", nullable = false)
    private String baseText;

    @Column(name = "delta_text", columnDefinition = "TEXT")
    private String deltaText;

    @Column(name = "compiled_text", columnDefinition = "TEXT", nullable = false)
    private String compiledText;

    /** ADMIN | AUTOTUNE */
    @Column(nullable = false, length = 20)
    private String source;

    /** ACTIVE | SHADOW | SUPERSEDED | REJECTED */
    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "created_by")
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
