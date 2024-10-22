package vacademy.io.common.db_logging.service;


import vacademy.io.common.db_logging.entity.SystemAlertLog;
import vacademy.io.common.db_logging.repository.SystemAlertLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class SystemAlertLogService {
    @Autowired
    SystemAlertLogRepository repository;

    public void createNewSystemAlert(String title, String description, String level, String userId, String siteId) {
        try{
            SystemAlertLog log = new SystemAlertLog();
            log.setUserId(userId);
            log.setSubject(title);
            log.setSiteId(siteId);
            log.setMessage(description);
            log.setLevel(level);
            repository.save(log);
        }
        catch (Exception e) {  }
    }
}
