package vacademy.io.common.scheduler.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.common.scheduler.entity.SchedulerActivityLog;

import java.util.Optional;

@Repository
public interface SchedulerActivityRepository extends JpaRepository<SchedulerActivityLog, String> {
    Optional<SchedulerActivityLog> findByTaskNameAndCronProfileIdAndCronProfileType(String taskName, String cronId, String cronType);
}
