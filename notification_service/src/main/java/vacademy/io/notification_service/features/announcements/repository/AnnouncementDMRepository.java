package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.AnnouncementDM;
import vacademy.io.notification_service.features.announcements.enums.MessagePriority;

import java.util.List;

@Repository
public interface AnnouncementDMRepository extends JpaRepository<AnnouncementDM, String> {
    
    List<AnnouncementDM> findByAnnouncementId(String announcementId);
    
    List<AnnouncementDM> findByAnnouncementIdAndIsActive(String announcementId, Boolean isActive);
    
    List<AnnouncementDM> findByMessagePriorityAndIsActiveOrderByCreatedAtDesc(MessagePriority messagePriority, Boolean isActive);
    
    List<AnnouncementDM> findByDeliveryConfirmationRequiredAndIsActive(Boolean deliveryConfirmationRequired, Boolean isActive);
    
    void deleteByAnnouncementId(String announcementId);
}