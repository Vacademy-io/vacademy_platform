package vacademy.io.common.db_logging.repository;


import vacademy.io.common.db_logging.entity.SystemAlertLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SystemAlertLogRepository extends JpaRepository<SystemAlertLog, String> {

}
