package vacademy.io.admin_core_service.features.workflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowExecutionStatus;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowType;

import java.time.Instant;

@Entity
@Table(name = "workflow_execution")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class WorkflowExecution {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workflow_id", nullable = false, foreignKey = @ForeignKey(name = "fk_workflow_execution_workflow"))
    private Workflow workflow;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workflow_schedule_id", foreignKey = @ForeignKey(name = "fk_workflow_execution_schedule"))
    private WorkflowSchedule workflowSchedule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workflow_trigger_id", foreignKey = @ForeignKey(name = "fk_workflow_execution_trigger"))
    private WorkflowTrigger workflowTrigger;

    @Enumerated(EnumType.STRING)
    @Column(name = "workflow_type", nullable = false)
    @Builder.Default
    private WorkflowType workflowType = WorkflowType.SCHEDULED;

    @Column(name = "idempotency_key", nullable = false, unique = true)
    private String idempotencyKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private WorkflowExecutionStatus status;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
