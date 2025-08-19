package vacademy.io.admin_core_service.features.workflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "workflow_schedule")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class WorkflowSchedule {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "workflow_id", nullable = false)
    private String workflowId;

    @Column(name = "schedule_type", nullable = false)
    private String scheduleType; // CRON | INTERVAL | DAILY | WEEKLY | MONTHLY

    @Column(name = "cron_expr")
    private String cronExpr;

    @Column(name = "timezone", nullable = false)
    private String timezone;

    @Column(name = "interval_minutes")
    private Integer intervalMinutes;

    @Column(name = "start_date", nullable = false)
    private Date startDate;

    @Column(name = "end_date")
    private Date endDate;

    @Column(name = "status", nullable = false)
    private String status; // ACTIVE | PAUSED | DISABLED

    @Column(name = "last_run_at")
    private Date lastRunAt;

    @Column(name = "next_run_at")
    private Date nextRunAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}