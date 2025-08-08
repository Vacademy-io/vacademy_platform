package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.AnnouncementMedium;
import vacademy.io.notification_service.features.announcements.enums.MediumType;

import java.util.List;

@Repository
public interface AnnouncementMediumRepository extends JpaRepository<AnnouncementMedium, String> {
    
    List<AnnouncementMedium> findByAnnouncementId(String announcementId);
    
    List<AnnouncementMedium> findByAnnouncementIdAndIsActive(String announcementId, Boolean isActive);
    
    List<AnnouncementMedium> findByAnnouncementIdAndMediumType(String announcementId, MediumType mediumType);
    
    void deleteByAnnouncementId(String announcementId);
}