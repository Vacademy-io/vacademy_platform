package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.ScheduledMessage;
import vacademy.io.notification_service.features.announcements.enums.ScheduleType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ScheduledMessageRepository extends JpaRepository<ScheduledMessage, String> {
    
    List<ScheduledMessage> findByAnnouncementId(String announcementId);
    
    Optional<ScheduledMessage> findByAnnouncementIdAndIsActive(String announcementId, Boolean isActive);
    
    List<ScheduledMessage> findByScheduleTypeAndIsActive(ScheduleType scheduleType, Boolean isActive);
    
    @Query("SELECT sm FROM ScheduledMessage sm WHERE sm.isActive = true AND sm.nextRunTime <= :currentTime")
    List<ScheduledMessage> findScheduledMessagesToProcess(@Param("currentTime") LocalDateTime currentTime);
    
    @Query("SELECT sm FROM ScheduledMessage sm WHERE sm.isActive = true AND sm.scheduleType = :scheduleType AND sm.nextRunTime <= :currentTime")
    List<ScheduledMessage> findScheduledMessagesByTypeToProcess(@Param("scheduleType") ScheduleType scheduleType, 
                                                               @Param("currentTime") LocalDateTime currentTime);
    
    void deleteByAnnouncementId(String announcementId);
}