package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.AnnouncementDashboardPin;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AnnouncementDashboardPinRepository extends JpaRepository<AnnouncementDashboardPin, String> {
    
    List<AnnouncementDashboardPin> findByAnnouncementId(String announcementId);
    
    List<AnnouncementDashboardPin> findByAnnouncementIdAndIsActive(String announcementId, Boolean isActive);
    
    @Query("SELECT adp FROM AnnouncementDashboardPin adp WHERE adp.isActive = true AND adp.pinEndTime > :currentTime ORDER BY adp.priority DESC, adp.pinStartTime ASC")
    List<AnnouncementDashboardPin> findActivePins(@Param("currentTime") LocalDateTime currentTime);
    
    @Query("SELECT adp FROM AnnouncementDashboardPin adp WHERE adp.isActive = true AND adp.pinEndTime > :currentTime AND adp.position = :position ORDER BY adp.priority DESC, adp.pinStartTime ASC")
    List<AnnouncementDashboardPin> findActivePinsByPosition(@Param("currentTime") LocalDateTime currentTime, @Param("position") String position);
    
    @Query("SELECT adp FROM AnnouncementDashboardPin adp WHERE adp.isActive = true AND adp.pinEndTime <= :currentTime")
    List<AnnouncementDashboardPin> findExpiredPins(@Param("currentTime") LocalDateTime currentTime);
    
    void deleteByAnnouncementId(String announcementId);
}