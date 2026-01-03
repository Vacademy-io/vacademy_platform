package vacademy.io.notification_service.features.notification_log.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface NotificationLogRepository extends JpaRepository<NotificationLog, String> {
    
    // Find original email sending log for a recipient before SES event time
    Optional<NotificationLog> findTopByChannelIdAndNotificationTypeAndNotificationDateBeforeOrderByNotificationDateDesc(
            String channelId, String notificationType, LocalDateTime before);
    
    // Removed duplicate checking methods - back to original behavior
            
    // Debug method: Find any EMAIL logs for a recipient (for debugging)
    Optional<NotificationLog> findTopByChannelIdAndNotificationTypeOrderByNotificationDateDesc(
            String channelId, String notificationType);

    Optional<NotificationLog> findTopByNotificationTypeAndSourceIdOrderByNotificationDateDesc(
            String notificationType,
            String sourceId
    );

    Optional<NotificationLog> findTopByChannelIdAndSenderBusinessChannelIdAndNotificationTypeOrderByNotificationDateDesc(
            String channelId,               // User's Phone Number
            String senderBusinessChannelId, // Institute's WhatsApp Number ID
            String notificationType         // "WHATSAPP_OUTGOING"
    );
            
    // Debug method: Find any logs for a recipient (for debugging)
    Optional<NotificationLog> findTopByChannelIdOrderByNotificationDateDesc(String channelId);
    
    // Debug method: Find all recent EMAIL logs for comparison
    List<NotificationLog> findTop10ByNotificationTypeOrderByNotificationDateDesc(String notificationType);
    
    // Find recent EMAIL logs within time window
    Optional<NotificationLog> findTopByNotificationTypeAndNotificationDateAfterOrderByNotificationDateDesc(
            String notificationType, LocalDateTime after);
    
    // All duplicate checking methods removed
    
    // ==================== NEW METHODS FOR ANNOUNCEMENT EMAIL TRACKING ====================
    
    /**
     * Find all original EMAIL logs for a specific announcement
     */
    List<NotificationLog> findBySourceIdAndNotificationType(String sourceId, String notificationType);
    
    /**
     * Find all EMAIL_EVENT logs whose source field matches one of the original email log IDs
     * This gets all SES events (delivery, open, click, bounce) for emails sent for this announcement
     */
    @Query("SELECT nl FROM NotificationLog nl WHERE nl.notificationType = 'EMAIL_EVENT' AND nl.source IN :emailLogIds")
    List<NotificationLog> findEmailEventsBySourceIds(@Param("emailLogIds") List<String> emailLogIds);
    
    /**
     * Get latest event for each email (based on source which is the original log ID)
     * Returns the most recent EMAIL_EVENT for each unique source (original email)
     * Uses multiple order criteria to handle duplicate timestamps
     */
    @Query("""
        SELECT nl FROM NotificationLog nl 
        WHERE nl.notificationType = 'EMAIL_EVENT' 
        AND nl.source IN :emailLogIds
        AND (nl.updatedAt, nl.createdAt, nl.id) IN (
            SELECT MAX(nl2.updatedAt), MAX(nl2.createdAt), MAX(nl2.id)
            FROM NotificationLog nl2 
            WHERE nl2.source = nl.source 
            AND nl2.notificationType = 'EMAIL_EVENT'
            GROUP BY nl2.source
        )
        ORDER BY nl.updatedAt DESC
    """)
    List<NotificationLog> findLatestEmailEventsBySourceIds(@Param("emailLogIds") List<String> emailLogIds);
    
    /**
     * Alternative: Get latest event for each email using window function approach
     * More reliable for handling duplicate timestamps
     */
    @Query(value = """
        SELECT DISTINCT ON (source) *
        FROM notification_log 
        WHERE notification_type = 'EMAIL_EVENT' 
        AND source = ANY(CAST(:emailLogIds AS text[]))
        ORDER BY source, updated_at DESC, created_at DESC, id DESC
    """, nativeQuery = true)
    List<NotificationLog> findLatestEmailEventsBySourceIdsNative(@Param("emailLogIds") String[] emailLogIds);
    
    /**
     * Find all emails sent to a specific user (by userId) with pagination
     */
    @Query("""
        SELECT nl FROM NotificationLog nl 
        WHERE nl.userId = :userId 
        AND nl.notificationType = 'EMAIL'
        ORDER BY nl.notificationDate DESC
    """)
    Page<NotificationLog> findEmailsByUserId(@Param("userId") String userId, Pageable pageable);
    
    /**
     * Find all emails sent to a specific email address (by channelId) with pagination
     */
    @Query("""
        SELECT nl FROM NotificationLog nl 
        WHERE nl.channelId = :email 
        AND nl.notificationType = 'EMAIL'
        ORDER BY nl.notificationDate DESC
    """)
    Page<NotificationLog> findEmailsByChannelId(@Param("email") String email, Pageable pageable);
    
    /**
     * Get latest event for a specific email log ID using native query
     * More reliable than JPQL for handling duplicates
     */
    @Query(value = """
        SELECT * FROM notification_log 
        WHERE notification_type = 'EMAIL_EVENT' 
        AND source = :emailLogId
        ORDER BY updated_at DESC, created_at DESC, id DESC
        LIMIT 1
    """, nativeQuery = true)
    Optional<NotificationLog> findLatestEmailEventBySourceIdNative(@Param("emailLogId") String emailLogId);
    
    /**
     * Alternative method using method name convention (may not work reliably)
     */
    Optional<NotificationLog> findTopByNotificationTypeAndSourceOrderByUpdatedAtDescCreatedAtDescIdDesc(
            String notificationType, String source);
    
    /**
     * Check for duplicate events - find existing event with same source, type, and sourceId
     */
    Optional<NotificationLog> findBySourceAndNotificationTypeAndSourceId(
            String source, String notificationType, String sourceId);
    
    /**
     * Find all events for a specific source and notification type
     */
    List<NotificationLog> findBySourceAndNotificationType(String source, String notificationType);

    @Query(value = """
        SELECT DISTINCT anchor.user_id 
        FROM notification_log anchor
        INNER JOIN notification_log reaction 
            ON anchor.channel_id = reaction.channel_id
        WHERE 
            -- 1. Match the Anchor (Outgoing Message)
            anchor.notification_type = :anchorType 
            AND anchor.body = :anchorBody
            
            -- 2. Match the Reaction (Delivered/Incoming)
            AND reaction.notification_type = :reactionType
            AND reaction.body = :reactionBody
            
            -- 3. Logic: Reaction must be AFTER Anchor
            AND reaction.created_at > anchor.created_at
            
            -- 4. CRITICAL: Strict Adjacency Check
            -- Ensure NO other 'Anchor' message exists between this Anchor and the Reaction
            AND NOT EXISTS (
                SELECT 1 
                FROM notification_log intermediate
                WHERE intermediate.channel_id = anchor.channel_id
                  AND intermediate.notification_type = :anchorType
                  AND intermediate.created_at > anchor.created_at
                  AND intermediate.created_at < reaction.created_at
            )
            
            -- 5. Return valid User ID
            AND anchor.user_id IS NOT NULL
    """, nativeQuery = true)
    List<String> findUserIdsByAdjacentMessagePair(
            @Param("anchorType") String anchorType,
            @Param("anchorBody") String anchorBody,
            @Param("reactionType") String reactionType,
            @Param("reactionBody") String reactionBody
    );
    
    // ==================== ENGAGEMENT TRIGGER METHODS ====================
    
    /**
     * Check if engagement trigger was already executed for a user
     */
    boolean existsByNotificationTypeAndUserIdAndSourceAndSourceId(
            String notificationType,
            String userId,
            String source,
            String sourceId
    );
    
    /**
     * Find the most recent engagement trigger execution for a user and config
     */
    Optional<NotificationLog> findTopByNotificationTypeAndUserIdAndSourceAndSourceIdOrderByCreatedAtDesc(
            String notificationType,
            String userId,
            String source,
            String sourceId
    );
}
