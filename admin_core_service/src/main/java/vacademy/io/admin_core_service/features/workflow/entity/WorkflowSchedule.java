package vacademy.io.admin_core_service.features.workflow.entity;

import lombok.Data;
import lombok.Setter;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "workflow_schedule")
@Data
@Setter
public class WorkflowSchedule {
    @Id
    @Column(name = "id", nullable = false, unique = true)
    private String id; // Changed from Long to String

    @Column(name = "workflow_id")
    private String workflowId;

    @Column(name = "schedule_type")
    private String scheduleType;

    @Column(name = "cron_expr")
    private String cronExpression;

    @Column(name = "interval_minutes")
    private Integer intervalMinutes;

    @Column(name = "day_of_month")
    private Integer dayOfMonth;

    @Column(name = "timezone")
    private String timezone;

    @Column(name = "start_date")
    private Instant startDate;

    @Column(name = "end_date")
    private Instant endDate;

    @Column(name = "status")
    private String status; // ACTIVE, INACTIVE, etc.

    @Column(name = "last_run_at")
    private Instant lastRunAt;

    @Column(name = "next_run_at")
    private Instant nextRunAt;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Transient
    private Map<String, Object> initialContext;

    // Helper method to check if schedule is active
    public boolean isActive() {
        return "ACTIVE".equalsIgnoreCase(status);
    }

    // Helper method to set active status
    public void setIsActive(boolean active) {
        this.status = active ? "ACTIVE" : "INACTIVE";
    }

    // Helper method to get next execution time
    public Instant getNextExecutionTime() {
        return nextRunAt;
    }

    // Helper method to set next execution time
    public void setNextExecutionTime(Instant nextExecutionTime) {
        this.nextRunAt = nextExecutionTime;
    }

    // Helper method to get last execution time
    public Instant getLastExecutionTime() {
        return lastRunAt;
    }

    // Helper method to set last execution time
    public void setLastExecutionTime(Instant lastExecutionTime) {
        this.lastRunAt = lastExecutionTime;
    }
}

