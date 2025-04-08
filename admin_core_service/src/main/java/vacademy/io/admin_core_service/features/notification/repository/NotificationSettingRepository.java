package vacademy.io.admin_core_service.features.notification.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.notification.entity.NotificationSetting;

import java.util.List;
import java.util.Optional;

public interface NotificationSettingRepository extends JpaRepository<NotificationSetting, String> {
    Optional<NotificationSetting> findBySourceAndSourceIdAndTypeAndStatusIn(
            String source,
            String sourceId,
             String type,
             List<String> statusList
    );
}
