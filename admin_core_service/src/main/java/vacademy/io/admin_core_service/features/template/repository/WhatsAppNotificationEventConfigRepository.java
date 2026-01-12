package vacademy.io.admin_core_service.features.template.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.template.entity.WhatsAppNotificationEventConfig;

import java.util.Optional;

@Repository
public interface WhatsAppNotificationEventConfigRepository
        extends JpaRepository<WhatsAppNotificationEventConfig, String> {

    /**
     * Find notification event configuration by event name, source type, source ID,
     * template type, and active status
     */
    Optional<WhatsAppNotificationEventConfig> findByEventNameAndSourceTypeAndSourceIdAndTemplateTypeAndIsActive(
            String eventName,
            String sourceType,
            String sourceId,
            String templateType,
            Boolean isActive);
}
