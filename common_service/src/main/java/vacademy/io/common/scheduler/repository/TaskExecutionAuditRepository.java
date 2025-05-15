package vacademy.io.common.scheduler.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.common.scheduler.entity.SchedulerActivityLog;
import vacademy.io.common.scheduler.entity.TaskExecutionAudit;

import java.util.List;

@Repository
public interface TaskExecutionAuditRepository extends JpaRepository<TaskExecutionAudit, String> {
    List<TaskExecutionAudit> findBySchedulerActivityLogAndStatus(SchedulerActivityLog taskLog, String name);

    boolean existsBySchedulerActivityLogAndStatus(SchedulerActivityLog taskLog, String name);
}
