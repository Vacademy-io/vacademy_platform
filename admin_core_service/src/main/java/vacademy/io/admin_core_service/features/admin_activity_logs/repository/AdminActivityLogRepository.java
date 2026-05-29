package vacademy.io.admin_core_service.features.admin_activity_logs.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.admin_activity_logs.entity.AdminActivityLog;

import java.sql.Timestamp;

@Repository
public interface AdminActivityLogRepository
        extends JpaRepository<AdminActivityLog, String>, JpaSpecificationExecutor<AdminActivityLog> {

    /**
     * Chunked retention delete. Returns the number of rows removed; the
     * retention job loops until this returns 0.
     */
    @Modifying
    @Query(value = """
            DELETE FROM admin_activity_log
             WHERE id IN (
                 SELECT id FROM admin_activity_log
                  WHERE created_at < :cutoff
                  LIMIT :batchSize
             )
            """, nativeQuery = true)
    int deleteOlderThan(@Param("cutoff") Timestamp cutoff, @Param("batchSize") int batchSize);
}
