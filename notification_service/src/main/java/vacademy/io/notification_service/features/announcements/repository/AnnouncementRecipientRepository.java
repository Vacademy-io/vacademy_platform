package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.AnnouncementRecipient;
import vacademy.io.notification_service.features.announcements.enums.RecipientType;

import java.util.List;

@Repository
public interface AnnouncementRecipientRepository extends JpaRepository<AnnouncementRecipient, String> {
    
    List<AnnouncementRecipient> findByAnnouncementId(String announcementId);
    
    List<AnnouncementRecipient> findByAnnouncementIdAndRecipientType(String announcementId, RecipientType recipientType);
    
    List<AnnouncementRecipient> findByRecipientTypeAndRecipientId(RecipientType recipientType, String recipientId);
    
    List<AnnouncementRecipient> findByAnnouncementIdAndIsActive(String announcementId, Boolean isActive);
    
    void deleteByAnnouncementId(String announcementId);
}