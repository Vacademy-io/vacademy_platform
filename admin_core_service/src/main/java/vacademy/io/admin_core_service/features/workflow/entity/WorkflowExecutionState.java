package vacademy.io.admin_core_service.features.workflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "workflow_execution_state")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class WorkflowExecutionState {

    // The column is uuid (V180). Use a real UUID field so Hibernate binds a UUID
    // natively (a String field + @UuidGenerator binds varchar → "column id is of
    // type uuid but expression is of type character varying" on every pause insert).
    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true, updatable = false)
    private UUID id;

    @Column(name = "execution_id", nullable = false)
    private String executionId;

    @Column(name = "paused_at_node_id", nullable = false)
    private String pausedAtNodeId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "serialized_context", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> serializedContext;

    @Column(name = "resume_at")
    private Instant resumeAt;

    @Column(name = "pause_reason", nullable = false)
    private String pauseReason; // DELAY, APPROVAL, EXTERNAL_WAIT

    @Column(name = "status", nullable = false)
    private String status; // WAITING, RESUMED, EXPIRED, CANCELLED

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
