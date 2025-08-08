package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.MessageInteraction;
import vacademy.io.notification_service.features.announcements.enums.InteractionType;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageInteractionRepository extends JpaRepository<MessageInteraction, String> {
    
    List<MessageInteraction> findByRecipientMessageId(String recipientMessageId);
    
    List<MessageInteraction> findByUserId(String userId);
    
    List<MessageInteraction> findByUserIdAndInteractionType(String userId, InteractionType interactionType);
    
    Optional<MessageInteraction> findByRecipientMessageIdAndUserIdAndInteractionType(String recipientMessageId, String userId, InteractionType interactionType);
    
    boolean existsByRecipientMessageIdAndUserIdAndInteractionType(String recipientMessageId, String userId, InteractionType interactionType);
    
    long countByRecipientMessageIdAndInteractionType(String recipientMessageId, InteractionType interactionType);
    
    @Query("SELECT COUNT(mi) FROM MessageInteraction mi JOIN RecipientMessage rm ON mi.recipientMessageId = rm.id WHERE rm.announcementId = :announcementId AND mi.interactionType = :interactionType")
    long countByAnnouncementIdAndInteractionType(@Param("announcementId") String announcementId, @Param("interactionType") InteractionType interactionType);
}