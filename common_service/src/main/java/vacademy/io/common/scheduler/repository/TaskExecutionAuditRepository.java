package vacademy.io.common.scheduler.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.common.scheduler.entity.TaskExecutionAudit;

@Repository
public interface TaskExecutionAuditRepository extends JpaRepository<TaskExecutionAudit, String> {
}
