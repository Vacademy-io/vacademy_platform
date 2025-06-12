package vacademy.io.admin_core_service.features.live_session.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionLogs;


public interface LiveSessionLogsRepository extends JpaRepository<LiveSessionLogs, String> {


}