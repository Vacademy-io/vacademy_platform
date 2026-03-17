package vacademy.io.admin_core_service.features.workflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

/**
 * Represents an event-based trigger for a workflow.
 * Maps an application event (e.g., "USER_SIGNUP") to a workflow
 * that should be executed when the event occurs.
 */
@Entity
@Table(name = "workflow_trigger")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class WorkflowTrigger {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true, updatable = false)
    private String id;

    @Column(name = "trigger_event_name", nullable = false)
    private String triggerEventName;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "description")
    private String description;

    @Column(name = "status", nullable = false)
    private String status; // ACTIVE, INACTIVE

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workflow_id", nullable = false)
    private Workflow workflow;

    @Column(name = "eventId")
    private String eventId;

    /**
     * JSON configuration for idempotency key generation.
     * Defines how to generate unique keys to prevent duplicate workflow executions.
     * Example:
     * {"strategy":"CONTEXT_BASED","contextFields":["userId"],"ttlMinutes":15}
     */
    @Column(name = "idempotency_generation_setting", columnDefinition = "TEXT")
    private String idempotencyGenerationSetting;
}
