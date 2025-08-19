package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.AnnouncementSystemAlert;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AnnouncementSystemAlertRepository extends JpaRepository<AnnouncementSystemAlert, String> {
    
    List<AnnouncementSystemAlert> findByAnnouncementId(String announcementId);
    
    List<AnnouncementSystemAlert> findByAnnouncementIdAndIsActive(String announcementId, Boolean isActive);
    
    List<AnnouncementSystemAlert> findByIsActiveOrderByPriorityDescCreatedAtDesc(Boolean isActive);
    
    @Query("SELECT asa FROM AnnouncementSystemAlert asa WHERE asa.isActive = true AND asa.autoDismissAfterHours IS NOT NULL AND asa.createdAt <= :cutoffTime")
    List<AnnouncementSystemAlert> findExpiredAlerts(@Param("cutoffTime") LocalDateTime cutoffTime);
    
    void deleteByAnnouncementId(String announcementId);
}