package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.MessageReply;

import java.util.List;

@Repository
public interface MessageReplyRepository extends JpaRepository<MessageReply, String> {
    
    Page<MessageReply> findByAnnouncementIdAndIsActiveOrderByCreatedAtDesc(String announcementId, Boolean isActive, Pageable pageable);
    
    List<MessageReply> findByAnnouncementIdAndParentMessageIdIsNullAndIsActiveOrderByCreatedAtDesc(String announcementId, Boolean isActive);
    
    List<MessageReply> findByParentMessageIdAndIsActiveOrderByCreatedAtAsc(String parentMessageId, Boolean isActive);
    
    Page<MessageReply> findByUserIdAndIsActiveOrderByCreatedAtDesc(String userId, Boolean isActive, Pageable pageable);
    
    long countByAnnouncementIdAndIsActive(String announcementId, Boolean isActive);
    
    long countByParentMessageIdAndIsActive(String parentMessageId, Boolean isActive);
    
    @Query("SELECT mr FROM MessageReply mr WHERE mr.announcementId = :announcementId AND mr.parentMessageId IS NULL AND mr.isActive = true ORDER BY mr.createdAt DESC")
    List<MessageReply> findTopLevelRepliesByAnnouncementId(@Param("announcementId") String announcementId);

    // Additional methods for UserMessageService
    
    /**
     * Get top 3 recent replies for an announcement
     */
    @Query("SELECT mr FROM MessageReply mr WHERE mr.announcementId = :announcementId AND mr.isActive = true ORDER BY mr.createdAt DESC")
    List<MessageReply> findTop3ByAnnouncementIdOrderByCreatedAtDesc(@Param("announcementId") String announcementId);
}