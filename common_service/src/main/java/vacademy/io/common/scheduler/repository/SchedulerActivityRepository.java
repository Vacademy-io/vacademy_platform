package vacademy.io.common.scheduler.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.common.scheduler.entity.SchedulerActivityLog;

import java.util.Optional;

@Repository
public interface SchedulerActivityRepository extends JpaRepository<SchedulerActivityLog, String> {

    @Query(value = """
            SELECT * from scheduler_activity_log
            WHERE task_name = :taskName
            AND cron_profile_id = :cronId
            AND cron_profile_type = :cronType
            ORDER BY created_at DESC LIMIT 1
            """,nativeQuery = true)
    Optional<SchedulerActivityLog> findByTaskNameAndCronProfileIdAndCronProfileType(@Param("taskName") String taskName,
                                                                                    @Param("cronId") String cronId,
                                                                                    @Param("cronType") String cronType);
}
