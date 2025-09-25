package vacademy.io.admin_core_service.features.notification.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.notification.entity.NotificationEventConfig;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationSourceType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationTemplateType;

import java.util.List;

@Repository
public interface NotificationEventConfigRepository extends JpaRepository<NotificationEventConfig, String> {

    /**
     * Find notification configs by event name and source details
     */
    @Query("SELECT nec FROM NotificationEventConfig nec " +
           "WHERE nec.eventName = :eventName " +
           "AND nec.sourceType = :sourceType " +
           "AND (nec.sourceId = :sourceId) " +
           "AND nec.isActive = true")
    List<NotificationEventConfig> findByEventAndSource(
            @Param("eventName") NotificationEventType eventName,
            @Param("sourceType") NotificationSourceType sourceType,
            @Param("sourceId") String sourceId
    );


    /**
     * Find notification configs by template type
     */
    @Query("SELECT nec FROM NotificationEventConfig nec " +
           "WHERE nec.eventName = :eventName " +
           "AND nec.templateType = :templateType " +
           "AND (nec.sourceId = :sourceId) " +
           "AND nec.isActive = true")
    List<NotificationEventConfig> findByEventAndTemplateType(
            @Param("eventName") NotificationEventType eventName,
            @Param("templateType") NotificationTemplateType templateType,
            @Param("sourceId") String sourceId
    );

    /**
     * Find notification configs by event name and source type (for global configs)
     */
    @Query("SELECT nec FROM NotificationEventConfig nec " +
           "WHERE nec.eventName = :eventName " +
           "AND nec.sourceType = :sourceType " +
           "AND nec.isActive = true")
    List<NotificationEventConfig> findByEventAndSourceType(
            @Param("eventName") NotificationEventType eventName,
            @Param("sourceType") NotificationSourceType sourceType
    );

    /**
     * Check if config exists for specific event and source
     */
    @Query("SELECT COUNT(nec) > 0 FROM NotificationEventConfig nec " +
           "WHERE nec.eventName = :eventName " +
           "AND nec.sourceType = :sourceType " +
           "AND nec.sourceId = :sourceId " +
           "AND nec.isActive = true")
    boolean existsByEventAndSource(
            @Param("eventName") NotificationEventType eventName,
            @Param("sourceType") NotificationSourceType sourceType,
            @Param("sourceId") String sourceId
    );
}
