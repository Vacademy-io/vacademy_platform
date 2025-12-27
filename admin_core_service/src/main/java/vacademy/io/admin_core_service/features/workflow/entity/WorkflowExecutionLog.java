package vacademy.io.admin_core_service.features.workflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.workflow.enums.ExecutionLogStatus;

import java.time.Instant;

/**
 * Entity representing detailed execution logs for each node in a workflow
 * execution.
 * Tracks node-level execution status, timing, input/output data, and errors.
 */
@Entity
@Table(name = "workflow_execution_log", indexes = {
        @Index(name = "idx_workflow_execution_id", columnList = "workflow_execution_id"),
        @Index(name = "idx_node_template_id", columnList = "node_template_id"),
        @Index(name = "idx_node_type", columnList = "node_type"),
        @Index(name = "idx_status", columnList = "status"),
        @Index(name = "idx_workflow_exec_status", columnList = "workflow_execution_id, status"),
        @Index(name = "idx_created_at", columnList = "created_at")
})
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class WorkflowExecutionLog {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "workflow_execution_id", nullable = false)
    private String workflowExecutionId;

    @Column(name = "node_template_id", nullable = false)
    private String nodeTemplateId;

    @Column(name = "node_type", nullable = false, length = 50)
    private String nodeType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ExecutionLogStatus status;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "execution_time_ms")
    private Long executionTimeMs;

    @Column(name = "details_json", columnDefinition = "TEXT")
    private String detailsJson;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "error_type", length = 100)
    private String errorType;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /**
     * Marks the log as completed and calculates execution time.
     * 
     * @param status Final status of the execution
     */
    public void markCompleted(ExecutionLogStatus status) {
        this.completedAt = Instant.now();
        this.status = status;
        if (this.startedAt != null) {
            this.executionTimeMs = this.completedAt.toEpochMilli() - this.startedAt.toEpochMilli();
        }
    }

    /**
     * Sets error information for failed executions.
     * 
     * @param errorMessage Detailed error message
     * @param errorType    Type/category of error (e.g., "SpelEvaluationException",
     *                     "HttpClientException")
     */
    public void setError(String errorMessage, String errorType) {
        this.errorMessage = errorMessage;
        this.errorType = errorType;
    }

    public Long calculateDuration() {
        if (this.executionTimeMs != null) {
            return this.executionTimeMs;
        }
        if (this.startedAt != null) {
            return Instant.now().toEpochMilli() - this.startedAt.toEpochMilli();
        }
        return 0L;
    }
}
