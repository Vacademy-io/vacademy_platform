package vacademy.io.notification_service.features.announcements.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.announcements.entity.RecipientMessage;
import vacademy.io.notification_service.features.announcements.enums.MediumType;
import vacademy.io.notification_service.features.announcements.enums.MessageStatus;
import vacademy.io.notification_service.features.announcements.enums.ModeType;

import java.util.List;

@Repository
public interface RecipientMessageRepository extends JpaRepository<RecipientMessage, String> {
    
    Page<RecipientMessage> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);
    
    Page<RecipientMessage> findByUserIdAndModeTypeOrderByCreatedAtDesc(String userId, ModeType modeType, Pageable pageable);
    
    List<RecipientMessage> findByAnnouncementId(String announcementId);
    
    List<RecipientMessage> findByAnnouncementIdAndStatus(String announcementId, MessageStatus status);
    
    List<RecipientMessage> findByUserIdAndStatus(String userId, MessageStatus status);
    
    @Query("SELECT rm FROM RecipientMessage rm WHERE rm.userId = :userId AND rm.modeType = :modeType AND NOT EXISTS (SELECT mi FROM MessageInteraction mi WHERE mi.recipientMessageId = rm.id AND mi.interactionType = 'READ')")
    List<RecipientMessage> findUnreadMessagesByUserAndMode(@Param("userId") String userId, @Param("modeType") ModeType modeType);
    
    @Query("SELECT COUNT(rm) FROM RecipientMessage rm WHERE rm.userId = :userId AND rm.modeType = :modeType AND NOT EXISTS (SELECT mi FROM MessageInteraction mi WHERE mi.recipientMessageId = rm.id AND mi.interactionType = 'READ')")
    long countUnreadMessagesByUserAndMode(@Param("userId") String userId, @Param("modeType") ModeType modeType);
    
    List<RecipientMessage> findByUserIdAndMediumTypeAndStatus(String userId, MediumType mediumType, MessageStatus status);
    
    long countByAnnouncementId(String announcementId);
    
    long countByAnnouncementIdAndStatus(String announcementId, MessageStatus status);

    // Utility finder for SSE event filtering/routing
    List<RecipientMessage> findByAnnouncementIdAndUserId(String announcementId, String userId);

    // Mode-specific queries with joins to mode-specific tables
    
    /**
     * Get resource messages with folder and category filtering
     */
    @Query("""
        SELECT rm FROM RecipientMessage rm 
        JOIN Announcement a ON rm.announcementId = a.id 
        JOIN AnnouncementResource ar ON ar.announcement.id = a.id 
        WHERE rm.userId = :userId 
          AND rm.modeType = 'RESOURCES' 
          AND ar.isActive = true
          AND (:folderName IS NULL OR ar.folderName = :folderName)
          AND (:category IS NULL OR ar.category = :category)
          AND NOT EXISTS (SELECT mi FROM MessageInteraction mi WHERE mi.recipientMessageId = rm.id AND mi.userId = :userId AND mi.interactionType = 'DISMISSED')
        ORDER BY rm.createdAt DESC
    """)
    Page<RecipientMessage> findResourceMessages(
            @Param("userId") String userId, 
            @Param("folderName") String folderName, 
            @Param("category") String category, 
            Pageable pageable);

    /**
     * Get community messages with type and tag filtering
     */
    @Query("""
        SELECT rm FROM RecipientMessage rm 
        JOIN Announcement a ON rm.announcementId = a.id 
        JOIN AnnouncementCommunity ac ON ac.announcement.id = a.id 
        WHERE rm.userId = :userId 
          AND rm.modeType = 'COMMUNITY' 
          AND ac.isActive = true
          AND (:communityType IS NULL OR ac.communityType = :communityType)
          AND (:tag IS NULL OR ac.tags LIKE CONCAT('%', :tag, '%'))
          AND NOT EXISTS (SELECT mi FROM MessageInteraction mi WHERE mi.recipientMessageId = rm.id AND mi.userId = :userId AND mi.interactionType = 'DISMISSED')
        ORDER BY rm.createdAt DESC
    """)
    Page<RecipientMessage> findCommunityMessages(
            @Param("userId") String userId, 
            @Param("communityType") String communityType, 
            @Param("tag") String tag, 
            Pageable pageable);

    /**
     * Get active dashboard pins (not dismissed and within duration)
     */
    @Query("""
        SELECT rm FROM RecipientMessage rm 
        JOIN Announcement a ON rm.announcementId = a.id 
        JOIN AnnouncementDashboardPin adp ON adp.announcement.id = a.id 
        WHERE rm.userId = :userId 
          AND rm.modeType = 'DASHBOARD_PIN' 
          AND adp.isActive = true
          AND (adp.pinEndTime IS NULL OR adp.pinEndTime > CURRENT_TIMESTAMP)
          AND NOT EXISTS (SELECT mi FROM MessageInteraction mi WHERE mi.recipientMessageId = rm.id AND mi.userId = :userId AND mi.interactionType = 'DISMISSED')
        ORDER BY adp.priority DESC, rm.createdAt DESC
    """)
    List<RecipientMessage> findActiveDashboardPins(@Param("userId") String userId);

    /**
     * Get stream messages with package session and stream type filtering
     */
    @Query("""
        SELECT rm FROM RecipientMessage rm 
        JOIN Announcement a ON rm.announcementId = a.id 
        JOIN AnnouncementStream as ON as.announcement.id = a.id 
        WHERE rm.userId = :userId 
          AND rm.modeType = 'STREAM' 
          AND as.isActive = true
          AND (:packageSessionId IS NULL OR as.packageSessionId = :packageSessionId)
          AND (:streamType IS NULL OR as.streamType = :streamType)
          AND NOT EXISTS (SELECT mi FROM MessageInteraction mi WHERE mi.recipientMessageId = rm.id AND mi.userId = :userId AND mi.interactionType = 'DISMISSED')
        ORDER BY rm.createdAt DESC
    """)
    Page<RecipientMessage> findStreamMessages(
            @Param("userId") String userId, 
            @Param("packageSessionId") String packageSessionId, 
            @Param("streamType") String streamType, 
            Pageable pageable);

    /**
     * Get system alerts with priority filtering
     */
    @Query("""
        SELECT rm FROM RecipientMessage rm 
        JOIN Announcement a ON rm.announcementId = a.id 
        JOIN AnnouncementSystemAlert asa ON asa.announcement.id = a.id 
        WHERE rm.userId = :userId 
          AND rm.modeType = 'SYSTEM_ALERT' 
          AND asa.isActive = true
          AND (:priority IS NULL OR asa.priority = :priority)
          AND NOT EXISTS (SELECT mi FROM MessageInteraction mi WHERE mi.recipientMessageId = rm.id AND mi.userId = :userId AND mi.interactionType = 'DISMISSED')
        ORDER BY asa.priority DESC, rm.createdAt DESC
    """)
    Page<RecipientMessage> findSystemAlerts(
            @Param("userId") String userId, 
            @Param("priority") String priority, 
            Pageable pageable);

    /**
     * Get direct messages
     */
    @Query("""
        SELECT rm FROM RecipientMessage rm 
        JOIN Announcement a ON rm.announcementId = a.id 
        JOIN AnnouncementDM adm ON adm.announcement.id = a.id 
        WHERE rm.userId = :userId 
          AND rm.modeType = 'DM' 
          AND adm.isActive = true
          AND NOT EXISTS (SELECT mi FROM MessageInteraction mi WHERE mi.recipientMessageId = rm.id AND mi.userId = :userId AND mi.interactionType = 'DISMISSED')
        ORDER BY adm.messagePriority DESC, rm.createdAt DESC
    """)
    Page<RecipientMessage> findDirectMessages(@Param("userId") String userId, Pageable pageable);

    /**
     * Get task messages with filtering by status and slide ID
     */
    @Query(value = """
        SELECT rm.* FROM recipient_messages rm 
        JOIN announcements a ON rm.announcement_id = a.id 
        JOIN announcement_tasks at ON at.announcement_id = a.id 
        WHERE rm.user_id = ?1 
          AND rm.mode_type = 'TASKS' 
          AND at.is_active = true
          AND (?2 IS NULL OR at.status = ?2)
          AND (?3 IS NULL OR at.slide_ids::text LIKE CONCAT('%"', ?3, '"%'))
          AND NOT EXISTS (SELECT 1 FROM message_interactions mi WHERE mi.recipient_message_id = rm.id AND mi.user_id = ?1 AND mi.interaction_type = 'DISMISSED')
        ORDER BY at.deadline_datetime ASC, rm.created_at DESC
    """, nativeQuery = true)
    Page<RecipientMessage> findTaskMessages(String userId, String status, String slideId, Pageable pageable);

    /**
     * Get active task messages (status = LIVE and not overdue)
     */
    @Query("""
        SELECT rm FROM RecipientMessage rm 
        JOIN Announcement a ON rm.announcementId = a.id 
        JOIN AnnouncementTask at ON at.announcement.id = a.id 
        WHERE rm.userId = :userId 
          AND rm.modeType = 'TASKS' 
          AND at.isActive = true
          AND at.status = 'LIVE'
          AND at.deadlineDateTime > CURRENT_TIMESTAMP
          AND NOT EXISTS (SELECT mi FROM MessageInteraction mi WHERE mi.recipientMessageId = rm.id AND mi.userId = :userId AND mi.interactionType = 'DISMISSED')
        ORDER BY at.deadlineDateTime ASC, rm.createdAt DESC
    """)
    List<RecipientMessage> findActiveTaskMessages(@Param("userId") String userId);

    /**
     * Get overdue task messages (status = OVERDUE or LIVE but past deadline)
     */
    @Query("""
        SELECT rm FROM RecipientMessage rm 
        JOIN Announcement a ON rm.announcementId = a.id 
        JOIN AnnouncementTask at ON at.announcement.id = a.id 
        WHERE rm.userId = :userId 
          AND rm.modeType = 'TASKS' 
          AND at.isActive = true
          AND (at.status = 'OVERDUE' OR (at.status = 'LIVE' AND at.deadlineDateTime < CURRENT_TIMESTAMP))
          AND NOT EXISTS (SELECT mi FROM MessageInteraction mi WHERE mi.recipientMessageId = rm.id AND mi.userId = :userId AND mi.interactionType = 'DISMISSED')
        ORDER BY at.deadlineDateTime ASC, rm.createdAt DESC
    """)
    List<RecipientMessage> findOverdueTaskMessages(@Param("userId") String userId);
}