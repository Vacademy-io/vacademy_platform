package vacademy.io.admin_core_service.features.workflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "workflow_schedule_run")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class WorkflowScheduleRun {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "schedule_id", nullable = false)
    private String scheduleId;

    @Column(name = "workflow_id", nullable = false)
    private String workflowId;

    @Column(name = "planned_run_at", nullable = false)
    private Date plannedRunAt;

    @Column(name = "fired_at")
    private Date firedAt;

    @Column(name = "status", nullable = false)
    private String status; // CREATED, DISPATCHED, SKIPPED, FAILED

    @Column(name = "dedupe_key", nullable = false)
    private String dedupeKey;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;
}