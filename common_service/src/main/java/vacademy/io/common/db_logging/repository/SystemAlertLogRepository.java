package vacademy.io.common.db_logging.repository;


import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.common.db_logging.entity.SystemAlertLog;

@Repository
public interface SystemAlertLogRepository extends JpaRepository<SystemAlertLog, String> {

}
