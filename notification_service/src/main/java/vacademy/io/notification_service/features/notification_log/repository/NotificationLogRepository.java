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

    // ==================== ANALYTICS LEADERBOARD & COHORT METHODS ====================

    /**
     * Get engagement leaderboard with pagination
     * Returns: user_id, channel_id (phone), outgoing_count, incoming_count, total_messages
     * Groups only by channel_id to ensure truly unique phone numbers
     */
    @Query(value = """
            SELECT 
                MAX(nl.user_id) as user_id,
                nl.channel_id,
                COUNT(CASE WHEN nl.notification_type = 'WHATSAPP_MESSAGE_OUTGOING' THEN 1 END) as outgoing_count,
                COUNT(CASE WHEN nl.notification_type = 'WHATSAPP_MESSAGE_INCOMING' THEN 1 END) as incoming_count,
                COUNT(*) as total_messages
            FROM notification_log nl
            WHERE nl.sender_business_channel_id = :channelId
                AND nl.created_at BETWEEN CAST(:startDate AS TIMESTAMP) AND CAST(:endDate AS TIMESTAMP)
                AND nl.user_id IS NOT NULL
                AND nl.channel_id IS NOT NULL
            GROUP BY nl.channel_id
            ORDER BY total_messages DESC
            LIMIT :limit OFFSET :offset
            """, nativeQuery = true)
    List<Object[]> getEngagementLeaderboard(
            @Param("channelId") String channelId,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate,
            @Param("limit") int limit,
            @Param("offset") int offset
    );

    /**
     * Get total count of engaged users for pagination
     * Counts unique channel_ids (phone numbers)
     */
    @Query(value = """
            SELECT COUNT(DISTINCT nl.channel_id)
            FROM notification_log nl
            WHERE nl.sender_business_channel_id = :channelId
                AND nl.created_at BETWEEN CAST(:startDate AS TIMESTAMP) AND CAST(:endDate AS TIMESTAMP)
                AND nl.user_id IS NOT NULL
                AND nl.channel_id IS NOT NULL
            """, nativeQuery = true)
    Long getTotalEngagedUsers(
            @Param("channelId") String channelId,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate
    );

    /**
     * Get users who completed challenge (received completion template)
     * Returns: user_id, channel_id (phone), completion_date
     * Groups only by channel_id to ensure truly unique phone numbers
     * Supports multiple template identifiers
     */
    @Query(value = """
            SELECT 
                MAX(nl.user_id) as user_id,
                nl.channel_id,
                MIN(nl.created_at) as completion_date
            FROM notification_log nl
            WHERE nl.sender_business_channel_id = :channelId
                AND nl.notification_type = 'WHATSAPP_MESSAGE_OUTGOING'
                AND EXISTS (
                    SELECT 1 FROM unnest(CAST(:templateIdentifiers AS text[])) AS template
                    WHERE nl.body LIKE CONCAT('%', template, '%')
                )
                AND nl.created_at BETWEEN CAST(:startDate AS TIMESTAMP) AND CAST(:endDate AS TIMESTAMP)
                AND nl.user_id IS NOT NULL
                AND nl.channel_id IS NOT NULL
            GROUP BY nl.channel_id
            ORDER BY completion_date DESC
            LIMIT :limit OFFSET :offset
            """, nativeQuery = true)
    List<Object[]> getCompletionCohort(
            @Param("channelId") String channelId,
            @Param("templateIdentifiers") String[] templateIdentifiers,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate,
            @Param("limit") int limit,
            @Param("offset") int offset
    );

    /**
     * Get total count of completed users for pagination
     * Counts unique channel_ids (phone numbers)
     * Supports multiple template identifiers
     */
    @Query(value = """
            SELECT COUNT(DISTINCT nl.channel_id)
            FROM notification_log nl
            WHERE nl.sender_business_channel_id = :channelId
                AND nl.notification_type = 'WHATSAPP_MESSAGE_OUTGOING'
                AND EXISTS (
                    SELECT 1 FROM unnest(CAST(:templateIdentifiers AS text[])) AS template
                    WHERE nl.body LIKE CONCAT('%', template, '%')
                )
                AND nl.created_at BETWEEN CAST(:startDate AS TIMESTAMP) AND CAST(:endDate AS TIMESTAMP)
                AND nl.user_id IS NOT NULL
                AND nl.channel_id IS NOT NULL
            """, nativeQuery = true)
    Long getTotalCompletedUsers(
            @Param("channelId") String channelId,
            @Param("templateIdentifiers") String[] templateIdentifiers,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate
    );

    /**
     * Find inactive users who received a template but didn't respond
     * Excludes users who replied at any time after receiving the template (within or after the day window)
     * Used for daily workflow to send follow-up only once
     * Returns list of unique user IDs
     */
    @Query(value = """
            WITH outgoing_users AS (
                SELECT DISTINCT ON (channel_id)
                    channel_id,
                    user_id,
                    notification_date,
                    sender_business_channel_id
                FROM notification_log
                WHERE notification_type = :messageType
                  AND sender_business_channel_id = :senderBusinessChannelId
                  AND body = :templateName
                  AND notification_date >= NOW() - CAST(:days || ' days' AS INTERVAL)
                  AND user_id IS NOT NULL
                ORDER BY channel_id, notification_date DESC
            ),
            users_who_responded AS (
                SELECT DISTINCT o.channel_id
                FROM outgoing_users o
                INNER JOIN notification_log i 
                    ON i.channel_id = o.channel_id
                    AND i.sender_business_channel_id = o.sender_business_channel_id
                WHERE i.notification_type = 'WHATSAPP_MESSAGE_INCOMING'
                  AND i.notification_date > o.notification_date
            )
            SELECT DISTINCT o.user_id
            FROM outgoing_users o
            LEFT JOIN users_who_responded r ON o.channel_id = r.channel_id
            WHERE r.channel_id IS NULL
            """, nativeQuery = true)
    List<String> findInactiveUsers(
            @Param("messageType") String messageType,
            @Param("senderBusinessChannelId") String senderBusinessChannelId,
            @Param("templateName") String templateName,
            @Param("days") Integer days
    );

    /**
     * Find users who have sent ALL messages from the given list
     * Returns userId from the most recent OUTGOING message for each matching channel
     */
    @Query(value = """
            WITH users_with_all_messages AS (
                SELECT channel_id
                FROM notification_log
                WHERE notification_type = :messageType
                  AND sender_business_channel_id = :senderBusinessChannelId
                  AND body = ANY(CAST(:messageList AS text[]))
                GROUP BY channel_id
                HAVING COUNT(DISTINCT body) = :messageCount
            ),
            latest_outgoing AS (
                SELECT DISTINCT ON (channel_id)
                    channel_id,
                    user_id
                FROM notification_log
                WHERE notification_type = 'WHATSAPP_MESSAGE_OUTGOING'
                  AND sender_business_channel_id = :senderBusinessChannelId
                ORDER BY channel_id, notification_date DESC
            )
            SELECT DISTINCT lo.user_id
            FROM users_with_all_messages u
            INNER JOIN latest_outgoing lo ON lo.channel_id = u.channel_id
            WHERE lo.user_id IS NOT NULL
            """, nativeQuery = true)
    List<String> findUsersByAllMessages(
            @Param("messageType") String messageType,
            @Param("senderBusinessChannelId") String senderBusinessChannelId,
            @Param("messageList") String[] messageList,
            @Param("messageCount") Integer messageCount
    );
}
