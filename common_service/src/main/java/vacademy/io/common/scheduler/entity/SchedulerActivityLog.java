package vacademy.io.common.scheduler.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Builder
@Table(name = "scheduler_activity_log")
public class SchedulerActivityLog {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "task_name")
    private String taskName;

    @Column(name = "status")
    private String status;

    @Column(name = "execution_time")
    private Date executionTime;

    @Column(name = "cron_profile_id")
    private String cronProfileId;

    @Column(name = "cron_profile_type")
    private String cronProfileType;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
