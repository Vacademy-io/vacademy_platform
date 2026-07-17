package vacademy.io.notification_service.features.notification_log.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface NotificationLogRepository extends JpaRepository<NotificationLog, String> {

    // Find original email sending log for a recipient before SES event time
    Optional<NotificationLog> findTopByChannelIdAndNotificationTypeAndNotificationDateBeforeOrderByNotificationDateDesc(
            String channelId, String notificationType, Instant before);

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

    @Query(value = """
            SELECT * FROM notification_log
            WHERE channel_id = :channelId
              AND notification_type = :notificationType
              AND body LIKE CONCAT('%', :provider, '%')
            ORDER BY notification_date DESC
            LIMIT 1
            """, nativeQuery = true)
    Optional<NotificationLog> findLatestOutgoingByChannelIdAndProvider(
            @Param("channelId") String channelId,
            @Param("notificationType") String notificationType,
            @Param("provider") String provider
    );

    // Debug method: Find any logs for a recipient (for debugging)
    Optional<NotificationLog> findTopByChannelIdOrderByNotificationDateDesc(String channelId);

    // Debug method: Find all recent EMAIL logs for comparison
    List<NotificationLog> findTop10ByNotificationTypeOrderByNotificationDateDesc(String notificationType);

    // Find recent EMAIL logs within time window
    Optional<NotificationLog> findTopByNotificationTypeAndNotificationDateAfterOrderByNotificationDateDesc(
            String notificationType, Instant after);

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
                    AND anchor.body LIKE CONCAT('%', :anchorBody, '%')
            
                    -- 2. Match the Reaction (Delivered/Incoming)
                    AND reaction.notification_type = :reactionType
                    AND reaction.body = :reactionBody
            
                    -- 3. Logic: Reaction must be AFTER Anchor
                    AND reaction.created_at > anchor.created_at
            
                    -- 4. Adjacency Check: ensure no DUPLICATE anchor template was sent between
                    -- this anchor and the reaction (so we always pick the latest anchor-reaction pair).
                    -- Intermediate chatbot text messages or unrelated outgoing messages do NOT break adjacency.
                    AND NOT EXISTS (
                        SELECT 1
                        FROM notification_log intermediate
                        WHERE intermediate.channel_id = anchor.channel_id
                          AND intermediate.notification_type = :anchorType
                          AND intermediate.body LIKE CONCAT('%', :anchorBody, '%')
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
     * Get engagement leaderboard with pagination.
     * Accepts a list of sender_business_channel_ids to support multi-channel institutes.
     */
    @Query(value = """
            SELECT
                MAX(nl.user_id) as user_id,
                nl.channel_id,
                COUNT(CASE WHEN nl.notification_type = 'WHATSAPP_MESSAGE_OUTGOING' THEN 1 END) as outgoing_count,
                COUNT(CASE WHEN nl.notification_type = 'WHATSAPP_MESSAGE_INCOMING' THEN 1 END) as incoming_count,
                COUNT(*) as total_messages,
                (COUNT(CASE WHEN nl.notification_type = 'WHATSAPP_MESSAGE_OUTGOING' THEN 1 END) +
                 (COUNT(CASE WHEN nl.notification_type = 'WHATSAPP_MESSAGE_INCOMING' THEN 1 END) * 2)) as engagement_score
            FROM notification_log nl
            WHERE nl.sender_business_channel_id IN (:channelIds)
                AND nl.created_at BETWEEN CAST(:startDate AS TIMESTAMP) AND CAST(:endDate AS TIMESTAMP)
                AND nl.notification_type IN ('WHATSAPP_MESSAGE_OUTGOING', 'WHATSAPP_MESSAGE_INCOMING')
                AND nl.user_id IS NOT NULL
                AND nl.channel_id IS NOT NULL
            GROUP BY nl.channel_id
            ORDER BY engagement_score DESC
            LIMIT :limit OFFSET :offset
            """, nativeQuery = true)
    List<Object[]> getEngagementLeaderboard(
            @Param("channelIds") List<String> channelIds,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate,
            @Param("limit") int limit,
            @Param("offset") int offset
    );

    /**
     * Get total count of engaged users for pagination across all channels of the institute.
     */
    @Query(value = """
            SELECT COUNT(DISTINCT nl.channel_id)
            FROM notification_log nl
            WHERE nl.sender_business_channel_id IN (:channelIds)
                AND nl.created_at BETWEEN CAST(:startDate AS TIMESTAMP) AND CAST(:endDate AS TIMESTAMP)
                AND nl.notification_type IN ('WHATSAPP_MESSAGE_OUTGOING', 'WHATSAPP_MESSAGE_INCOMING')
                AND nl.user_id IS NOT NULL
                AND nl.channel_id IS NOT NULL
            """, nativeQuery = true)
    Long getTotalEngagedUsers(
            @Param("channelIds") List<String> channelIds,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate
    );

    /**
     * Get users who completed challenge (received completion template).
     * Accepts a list of sender_business_channel_ids to support multi-channel institutes.
     */
    @Query(value = """
            SELECT
                MAX(nl.user_id) as user_id,
                nl.channel_id,
                MIN(nl.created_at) as completion_date
            FROM notification_log nl
            WHERE nl.sender_business_channel_id IN (:channelIds)
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
            @Param("channelIds") List<String> channelIds,
            @Param("templateIdentifiers") String[] templateIdentifiers,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate,
            @Param("limit") int limit,
            @Param("offset") int offset
    );

    /**
     * Get total count of completed users for pagination across all channels of the institute.
     */
    @Query(value = """
            SELECT COUNT(DISTINCT nl.channel_id)
            FROM notification_log nl
            WHERE nl.sender_business_channel_id IN (:channelIds)
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
            @Param("channelIds") List<String> channelIds,
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
     * Find phone numbers (channel_id) that received an OUTGOING WhatsApp message on the
     * given business channel within the last :days days, but sent NO INCOMING reply on
     * that channel within the same window.
     *
     * <p>Keyed entirely on channel_id (phone) — it never reads the outgoing row's user_id,
     * so it works on channels where outgoing user_id logging is missing (e.g. post-migration
     * channels). Returns the recipient phones in whatever digit form they are stored; the
     * caller is responsible for normalising before matching against lead mobiles.</p>
     *
     * <p>Used by the inactivity opt-out scan to detect leads who are still being messaged
     * but have gone silent.</p>
     */
    @Query(value = """
            SELECT DISTINCT o.channel_id
            FROM notification_log o
            WHERE o.notification_type = 'WHATSAPP_MESSAGE_OUTGOING'
              AND o.sender_business_channel_id = :senderBusinessChannelId
              AND o.channel_id IS NOT NULL
              AND o.notification_date >= NOW() - CAST(:days || ' days' AS INTERVAL)
              AND NOT EXISTS (
                  SELECT 1 FROM notification_log i
                  WHERE i.channel_id = o.channel_id
                    AND i.sender_business_channel_id = o.sender_business_channel_id
                    AND i.notification_type = 'WHATSAPP_MESSAGE_INCOMING'
                    AND i.notification_date >= NOW() - CAST(:days || ' days' AS INTERVAL)
              )
            """, nativeQuery = true)
    List<String> findInactivePhones(
            @Param("senderBusinessChannelId") String senderBusinessChannelId,
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

    // Chatbot flow session message history
    List<NotificationLog> findByChannelIdAndNotificationTypeInOrderByNotificationDateAsc(
            String channelId, List<String> notificationTypes);

    // ==================== LEAD-JOURNEY FUNNEL METHODS ====================

    /**
     * Fetch raw OUTGOING WhatsApp messages of a multi-day journey (matched by a
     * template-name prefix on the body, e.g. {@code lead_journey_day_}) for an
     * institute, optionally narrowed to one business channel and a date window.
     *
     * <p>Returns full rows so the service can parse the day number from the body
     * and the center from the message payload. Keyed on institute_id (reliably
     * stamped on these sends), so the caller need not know the channel id.
     * Bounded by {@code :limit} to protect against unbounded result sets.</p>
     */
    @Query(value = """
            SELECT * FROM notification_log nl
            WHERE nl.institute_id = :instituteId
              AND nl.notification_type = 'WHATSAPP_MESSAGE_OUTGOING'
              AND nl.body LIKE CONCAT('%', :templatePrefix, '%')
              AND (COALESCE(:channelId, '') = '' OR nl.sender_business_channel_id = :channelId)
              AND (COALESCE(:startDate, '') = '' OR nl.notification_date >= CAST(:startDate AS TIMESTAMP))
              AND (COALESCE(:endDate, '') = '' OR nl.notification_date <= CAST(:endDate AS TIMESTAMP))
              AND nl.channel_id IS NOT NULL
            ORDER BY nl.notification_date ASC
            LIMIT :limit
            """, nativeQuery = true)
    List<NotificationLog> findJourneyOutgoingLogs(
            @Param("instituteId") String instituteId,
            @Param("channelId") String channelId,
            @Param("templatePrefix") String templatePrefix,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate,
            @Param("limit") int limit
    );

    /**
     * Of the given recipient phones, return those that sent at least one INCOMING
     * WhatsApp message to the institute within the window (i.e. replied at all).
     * Used to compute reply rates for the lead-journey funnel.
     */
    @Query(value = """
            SELECT DISTINCT i.channel_id
            FROM notification_log i
            WHERE i.institute_id = :instituteId
              AND i.notification_type = 'WHATSAPP_MESSAGE_INCOMING'
              AND i.channel_id IN (:phones)
              AND (COALESCE(:startDate, '') = '' OR i.notification_date >= CAST(:startDate AS TIMESTAMP))
              AND (COALESCE(:endDate, '') = '' OR i.notification_date <= CAST(:endDate AS TIMESTAMP))
            """, nativeQuery = true)
    List<String> findRepliedPhones(
            @Param("instituteId") String instituteId,
            @Param("phones") List<String> phones,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate
    );

    // ==================== COMMUNICATION TIMELINE METHODS ====================

    /**
     * Find all non-event logs for a user filtered by notification types, paginated and sorted by date DESC.
     * Used by the unified communication timeline to fetch EMAIL, WHATSAPP_MESSAGE_OUTGOING, WHATSAPP_MESSAGE_INCOMING.
     */
    @Query("""
                SELECT nl FROM NotificationLog nl
                WHERE nl.userId = :userId
                AND nl.notificationType IN :types
                ORDER BY nl.notificationDate DESC
            """)
    Page<NotificationLog> findByUserIdAndNotificationTypeInOrderByNotificationDateDesc(
            @Param("userId") String userId,
            @Param("types") List<String> types,
            Pageable pageable);

    /**
     * Find all non-event logs for a user filtered by notification types and date range.
     */
    @Query("""
                SELECT nl FROM NotificationLog nl
                WHERE nl.userId = :userId
                AND nl.notificationType IN :types
                AND (:fromDate IS NULL OR nl.notificationDate >= :fromDate)
                AND (:toDate IS NULL OR nl.notificationDate <= :toDate)
                ORDER BY nl.notificationDate DESC
            """)
    Page<NotificationLog> findByUserIdAndTypesAndDateRange(
            @Param("userId") String userId,
            @Param("types") List<String> types,
            @Param("fromDate") Instant fromDate,
            @Param("toDate") Instant toDate,
            Pageable pageable);

    // ==================== CHANNEL-ID BASED COMMUNICATION TIMELINE ====================

    /** Single channel: channelId (email or phone) + type set, paginated DESC. */
    Page<NotificationLog> findByChannelIdAndNotificationTypeInOrderByNotificationDateDesc(
            String channelId, List<String> notificationTypes, Pageable pageable);

    /** Single channel with date range. */
    @Query("""
                SELECT nl FROM NotificationLog nl
                WHERE nl.channelId = :channelId
                AND nl.notificationType IN :types
                AND (:fromDate IS NULL OR nl.notificationDate >= :fromDate)
                AND (:toDate IS NULL OR nl.notificationDate <= :toDate)
                ORDER BY nl.notificationDate DESC
            """)
    Page<NotificationLog> findByChannelIdAndTypesAndDateRange(
            @Param("channelId") String channelId,
            @Param("types") List<String> types,
            @Param("fromDate") Instant fromDate,
            @Param("toDate") Instant toDate,
            Pageable pageable);

    /** Combined email + phone query — email matched to emailTypes, phone matched to phoneTypes. */
    @Query("""
                SELECT nl FROM NotificationLog nl
                WHERE (nl.channelId = :email AND nl.notificationType IN :emailTypes)
                   OR (nl.channelId = :phone AND nl.notificationType IN :phoneTypes)
                ORDER BY nl.notificationDate DESC
            """)
    Page<NotificationLog> findByEmailAndPhoneChannels(
            @Param("email") String email,
            @Param("phone") String phone,
            @Param("emailTypes") List<String> emailTypes,
            @Param("phoneTypes") List<String> phoneTypes,
            Pageable pageable);

    /** Combined email + phone query with date range. */
    @Query("""
                SELECT nl FROM NotificationLog nl
                WHERE (
                    (nl.channelId = :email AND nl.notificationType IN :emailTypes)
                    OR (nl.channelId = :phone AND nl.notificationType IN :phoneTypes)
                )
                AND (:fromDate IS NULL OR nl.notificationDate >= :fromDate)
                AND (:toDate IS NULL OR nl.notificationDate <= :toDate)
                ORDER BY nl.notificationDate DESC
            """)
    Page<NotificationLog> findByEmailAndPhoneChannelsAndDateRange(
            @Param("email") String email,
            @Param("phone") String phone,
            @Param("emailTypes") List<String> emailTypes,
            @Param("phoneTypes") List<String> phoneTypes,
            @Param("fromDate") Instant fromDate,
            @Param("toDate") Instant toDate,
            Pageable pageable);

    // ==================== WHATSAPP INBOX METHODS ====================

    /**
     * Get distinct conversations (unique phone numbers) with their latest message.
     * Uses DISTINCT ON to guarantee one row per channel_id (no duplicates).
     * Scopes by institute_id so template / campaign sends written by any path (chatbot reply,
     * announcement, WhatsAppService) all surface — provided the writer stamped institute_id.
     */
    @Query(value = """
            SELECT * FROM (
                SELECT DISTINCT ON (nl.channel_id) nl.*
                FROM notification_log nl
                WHERE nl.institute_id = :instituteId
                  AND nl.notification_type IN ('WHATSAPP_MESSAGE_OUTGOING', 'WHATSAPP_MESSAGE_INCOMING')
                ORDER BY nl.channel_id, nl.notification_date DESC
            ) conversations
            ORDER BY conversations.notification_date DESC
            LIMIT :limit OFFSET :offset
            """, nativeQuery = true)
    List<NotificationLog> findConversationsForInbox(
            @Param("instituteId") String instituteId,
            @Param("limit") int limit,
            @Param("offset") int offset);

    /**
     * Get messages for a specific phone number, scoped to an institute.
     * Cursor-paginated (newest first).
     */
    @Query(value = """
            SELECT * FROM notification_log
            WHERE channel_id = :phone
              AND institute_id = :instituteId
              AND notification_type IN ('WHATSAPP_MESSAGE_OUTGOING', 'WHATSAPP_MESSAGE_INCOMING')
              AND (:cursor IS NULL OR notification_date < CAST(:cursor AS TIMESTAMP))
            ORDER BY notification_date DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<NotificationLog> findMessagesForPhone(
            @Param("phone") String phone,
            @Param("instituteId") String instituteId,
            @Param("cursor") String cursor,
            @Param("limit") int limit);

    /**
     * Batch count unread messages for multiple phones in one query.
     * Returns rows of (channel_id, unread_count).
     */
    @Query(value = """
            SELECT sub.channel_id, COUNT(*) as unread_count
            FROM notification_log sub
            WHERE sub.channel_id IN (:phones)
              AND sub.notification_type = 'WHATSAPP_MESSAGE_INCOMING'
              AND sub.notification_date > (
                SELECT COALESCE(MAX(nl2.notification_date), CAST('1970-01-01' AS TIMESTAMP))
                FROM notification_log nl2
                WHERE nl2.channel_id = sub.channel_id
                  AND nl2.notification_type = 'WHATSAPP_MESSAGE_OUTGOING'
              )
            GROUP BY sub.channel_id
            """, nativeQuery = true)
    List<Object[]> batchCountUnreadMessages(@Param("phones") List<String> phones);

    /**
     * Search WhatsApp conversations by phone number or sender name, scoped to an institute.
     */
    @Query(value = """
            SELECT * FROM (
                SELECT DISTINCT ON (nl.channel_id) nl.*
                FROM notification_log nl
                WHERE nl.institute_id = :instituteId
                  AND nl.notification_type IN ('WHATSAPP_MESSAGE_OUTGOING', 'WHATSAPP_MESSAGE_INCOMING')
                  AND (nl.channel_id LIKE :query OR COALESCE(nl.sender_name, '') ILIKE :query)
                ORDER BY nl.channel_id, nl.notification_date DESC
            ) conversations
            ORDER BY conversations.notification_date DESC
            LIMIT 30
            """, nativeQuery = true)
    List<NotificationLog> searchConversations(
            @Param("instituteId") String instituteId,
            @Param("query") String query);

    // ==================== NOTIFICATION HUB METHODS ====================

    /**
     * Count outbound EMAILs in window for an institute. Scoped via the institute's configured
     * from-addresses (sender_business_channel_id IN ...).
     */
    @Query(value = """
            SELECT COUNT(*) FROM notification_log
            WHERE notification_type = 'EMAIL'
              AND sender_business_channel_id IN (:fromAddresses)
              AND notification_date >= CAST(:since AS TIMESTAMP)
            """, nativeQuery = true)
    long countEmailSent(@Param("fromAddresses") List<String> fromAddresses,
                       @Param("since") String since);

    /**
     * Count EMAIL_EVENTs by event name within window for an institute. Joins each event to
     * its parent EMAIL log via `source = parent.id`, then scopes by the institute's
     * configured from-addresses on the parent.
     *
     * The body prefix matches strings produced in EmailEventService.createEventDetailsBody:
     * "Email Event: DELIVERY\\n...", "Email Event: OPEN\\n...", etc. Pass the uppercase
     * event name (DELIVERY / OPEN / CLICK / BOUNCE / COMPLAINT / SEND / REJECT).
     */
    @Query(value = """
            SELECT COUNT(*) FROM notification_log ev
            INNER JOIN notification_log orig ON orig.id = ev.source
            WHERE ev.notification_type = 'EMAIL_EVENT'
              AND ev.body LIKE CONCAT('Email Event: ', :eventName, '%')
              AND orig.notification_type = 'EMAIL'
              AND orig.sender_business_channel_id IN (:fromAddresses)
              AND ev.notification_date >= CAST(:since AS TIMESTAMP)
            """, nativeQuery = true)
    long countEmailEvent(@Param("fromAddresses") List<String> fromAddresses,
                        @Param("eventName") String eventName,
                        @Param("since") String since);

    /**
     * Count INBOUND_EMAILs (learner replies) in window for an institute.
     */
    @Query(value = """
            SELECT COUNT(*) FROM notification_log
            WHERE notification_type = 'INBOUND_EMAIL'
              AND sender_business_channel_id IN (:fromAddresses)
              AND notification_date >= CAST(:since AS TIMESTAMP)
            """, nativeQuery = true)
    long countInboundEmail(@Param("fromAddresses") List<String> fromAddresses,
                          @Param("since") String since);

    /**
     * Count WhatsApp messages of a given type in window for an institute.
     * type = 'WHATSAPP_MESSAGE_OUTGOING' or 'WHATSAPP_MESSAGE_INCOMING'.
     */
    @Query(value = """
            SELECT COUNT(*) FROM notification_log
            WHERE notification_type = :type
              AND sender_business_channel_id IN (:channelIds)
              AND notification_date >= CAST(:since AS TIMESTAMP)
            """, nativeQuery = true)
    long countWhatsAppByType(@Param("channelIds") List<String> channelIds,
                            @Param("type") String type,
                            @Param("since") String since);

    /**
     * Recent incoming activity for the hub feed: WHATSAPP_MESSAGE_INCOMING + INBOUND_EMAIL
     * across an institute's WhatsApp channels and email addresses, newest first.
     */
    @Query(value = """
            SELECT * FROM notification_log
            WHERE sender_business_channel_id IN (:channelIds)
              AND notification_type IN ('WHATSAPP_MESSAGE_INCOMING', 'INBOUND_EMAIL')
            ORDER BY notification_date DESC
            LIMIT :limit OFFSET :offset
            """, nativeQuery = true)
    List<NotificationLog> findRecentIncomingForInstitute(
            @Param("channelIds") List<String> channelIds,
            @Param("limit") int limit,
            @Param("offset") int offset);

    // ==================== EMAIL INBOX METHODS ====================
    //
    // The hub UI lets admins narrow the inbox by:
    //   - direction → controlled by :types ('EMAIL' | 'INBOUND_EMAIL' | both)
    //   - which institute sender → controlled by :senderFilter (single address; null = any sender)
    //
    // Institute scoping is via :instituteId (the column stamped at write time by every writer
    // path and backfilled for historical rows in V25). The sender filter remains as an optional
    // narrowing for admins who want to see one specific from-address.

    /**
     * One row per counterparty email (the institute's audience), latest message first.
     * Scopes by institute_id; :senderFilter is an optional narrowing (null = all senders).
     * :types is {@code ['EMAIL']}, {@code ['INBOUND_EMAIL']}, or both.
     */
    @Query(value = """
            SELECT * FROM (
                SELECT DISTINCT ON (nl.channel_id) nl.*
                FROM notification_log nl
                WHERE nl.institute_id = :instituteId
                  AND nl.notification_type IN (:types)
                  AND (:senderFilter IS NULL OR nl.sender_business_channel_id = :senderFilter)
                ORDER BY nl.channel_id, nl.notification_date DESC
            ) conversations
            ORDER BY conversations.notification_date DESC
            LIMIT :limit OFFSET :offset
            """, nativeQuery = true)
    List<NotificationLog> findEmailConversationsForInbox(
            @Param("instituteId") String instituteId,
            @Param("senderFilter") String senderFilter,
            @Param("types") List<String> types,
            @Param("limit") int limit,
            @Param("offset") int offset);

    /**
     * Messages for one counterparty email, scoped + filtered.
     * Cursor-paginated (newest first).
     */
    @Query(value = """
            SELECT * FROM notification_log
            WHERE channel_id = :email
              AND institute_id = :instituteId
              AND (:senderFilter IS NULL OR sender_business_channel_id = :senderFilter)
              AND notification_type IN (:types)
              AND (:cursor IS NULL OR notification_date < CAST(:cursor AS TIMESTAMP))
            ORDER BY notification_date DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<NotificationLog> findEmailMessagesForConversation(
            @Param("email") String email,
            @Param("instituteId") String instituteId,
            @Param("senderFilter") String senderFilter,
            @Param("types") List<String> types,
            @Param("cursor") String cursor,
            @Param("limit") int limit);

    /**
     * Batch unread counts for email conversations: number of INBOUND_EMAIL rows newer than
     * the latest OUTBOUND EMAIL row to the same counterparty. Mirrors WhatsApp behavior.
     * Not affected by the direction filter — unread is intrinsically about inbound vs outbound.
     */
    @Query(value = """
            SELECT sub.channel_id, COUNT(*) as unread_count
            FROM notification_log sub
            WHERE sub.channel_id IN (:emails)
              AND sub.notification_type = 'INBOUND_EMAIL'
              AND sub.notification_date > (
                SELECT COALESCE(MAX(nl2.notification_date), CAST('1970-01-01' AS TIMESTAMP))
                FROM notification_log nl2
                WHERE nl2.channel_id = sub.channel_id
                  AND nl2.notification_type = 'EMAIL'
              )
            GROUP BY sub.channel_id
            """, nativeQuery = true)
    List<Object[]> batchCountUnreadEmailMessages(@Param("emails") List<String> emails);

    /**
     * Search email conversations by counterparty address or message body, scoped + filtered.
     */
    @Query(value = """
            SELECT * FROM (
                SELECT DISTINCT ON (nl.channel_id) nl.*
                FROM notification_log nl
                WHERE nl.institute_id = :instituteId
                  AND nl.notification_type IN (:types)
                  AND (:senderFilter IS NULL OR nl.sender_business_channel_id = :senderFilter)
                  AND (nl.channel_id ILIKE :query OR COALESCE(nl.body, '') ILIKE :query)
                ORDER BY nl.channel_id, nl.notification_date DESC
            ) conversations
            ORDER BY conversations.notification_date DESC
            LIMIT :limit OFFSET :offset
            """, nativeQuery = true)
    List<NotificationLog> searchEmailConversations(
            @Param("instituteId") String instituteId,
            @Param("senderFilter") String senderFilter,
            @Param("types") List<String> types,
            @Param("query") String query,
            @Param("limit") int limit,
            @Param("offset") int offset);

    // ==================== ENGAGEMENT LEDGER (batched per-subject rollups) ====================
    // One aggregate query per identifier type per cohort — never per subject. Rides
    // idx_notification_log_institute_channel (institute_id, channel_id, notification_type).
    // notification_date is TIMESTAMP WITHOUT TIME ZONE holding naive UTC (see V26) — Instant
    // params bind correctly because writers use Instant.now() under the container's UTC TZ pin;
    // do not add casts here (V26's header explains why).

    interface WhatsAppLedgerRow {
        String getChannelId();
        java.sql.Timestamp getLastSentAt();
        java.sql.Timestamp getLastDeliveredAt();
        java.sql.Timestamp getLastReadAt();
        java.sql.Timestamp getLastReplyAt();
        Long getRecentSends();
        Long getRecentReads();
        Long getRecentFailures();
    }

    @Query(value = """
            SELECT channel_id AS "channelId",
                   MAX(notification_date) FILTER (WHERE notification_type = 'WHATSAPP_MESSAGE_OUTGOING'
                       AND body NOT LIKE '%| Status: FAILED |%') AS "lastSentAt",
                   MAX(notification_date) FILTER (WHERE notification_type = 'WHATSAPP_MESSAGE_DELIVERED') AS "lastDeliveredAt",
                   MAX(notification_date) FILTER (WHERE notification_type = 'WHATSAPP_MESSAGE_READ') AS "lastReadAt",
                   MAX(notification_date) FILTER (WHERE notification_type = 'WHATSAPP_MESSAGE_INCOMING') AS "lastReplyAt",
                   COUNT(*) FILTER (WHERE notification_type = 'WHATSAPP_MESSAGE_OUTGOING'
                       AND body NOT LIKE '%| Status: FAILED |%'
                       AND notification_date >= :recentSince) AS "recentSends",
                   COUNT(*) FILTER (WHERE notification_type = 'WHATSAPP_MESSAGE_READ' AND notification_date >= :recentSince) AS "recentReads",
                   COUNT(DISTINCT source_id) FILTER (WHERE notification_type = 'WHATSAPP_MESSAGE_FAILED' AND notification_date >= :recentSince) AS "recentFailures"
            FROM notification_log
            WHERE institute_id = :instituteId
              AND channel_id IN (:phones)
              AND notification_type IN ('WHATSAPP_MESSAGE_OUTGOING', 'WHATSAPP_MESSAGE_DELIVERED',
                                        'WHATSAPP_MESSAGE_READ', 'WHATSAPP_MESSAGE_INCOMING',
                                        'WHATSAPP_MESSAGE_FAILED')
            GROUP BY channel_id
            """, nativeQuery = true)
    // recentSends/lastSentAt: provider-rejected attempts still write OUTGOING rows — success is
    // only encoded in the body ("... | Status: FAILED | ..."), a stable format written by
    // WhatsAppService.logWhatsAppMessages. Chatbot/inbox rows carry free-text bodies which
    // realistically never contain that exact template marker.
    // recentFailures: DISTINCT source_id (the wamid) because a Meta 'failed' status currently
    // writes TWO WHATSAPP_MESSAGE_FAILED rows (generic status writer + dedicated failure writer)
    // sharing the same wamid.
    List<WhatsAppLedgerRow> aggregateWhatsAppLedger(
            @Param("instituteId") String instituteId,
            @Param("phones") List<String> phones,
            @Param("recentSince") Instant recentSince);

    interface LatestBodyRow {
        String getChannelId();
        String getBody();
        java.sql.Timestamp getEventAt();
    }

    @Query(value = """
            SELECT DISTINCT ON (channel_id)
                   channel_id AS "channelId", body AS "body", notification_date AS "eventAt"
            FROM notification_log
            WHERE institute_id = :instituteId
              AND channel_id IN (:channelIds)
              AND notification_type = :notificationType
            ORDER BY channel_id, notification_date DESC
            """, nativeQuery = true)
    List<LatestBodyRow> findLatestBodyPerChannel(
            @Param("instituteId") String instituteId,
            @Param("channelIds") List<String> channelIds,
            @Param("notificationType") String notificationType);

    interface EmailLedgerRow {
        String getChannelId();
        java.sql.Timestamp getLastSentAt();
        java.sql.Timestamp getLastReplyAt();
        Long getRecentSends();
    }

    @Query(value = """
            SELECT LOWER(channel_id) AS "channelId",
                   MAX(notification_date) FILTER (WHERE notification_type = 'EMAIL') AS "lastSentAt",
                   MAX(notification_date) FILTER (WHERE notification_type = 'INBOUND_EMAIL') AS "lastReplyAt",
                   COUNT(*) FILTER (WHERE notification_type = 'EMAIL' AND notification_date >= :recentSince) AS "recentSends"
            FROM notification_log
            WHERE institute_id = :instituteId
              AND LOWER(channel_id) IN (:emails)
              AND notification_type IN ('EMAIL', 'INBOUND_EMAIL')
              AND (source IS NULL OR source <> 'announcement-service')
            GROUP BY LOWER(channel_id)
            """, nativeQuery = true)
    // LOWER on both sides: outbound EMAIL rows store the recipient as the caller passed it,
    // INBOUND_EMAIL stores the parsed From address lowercased — callers pass lowercased emails.
    // source <> 'announcement-service': announcements write a SECOND EMAIL row per recipient
    // (AnnouncementDeliveryService.createEmailNotificationLog) on top of the EmailService row
    // from the unified send, and also log failed attempts as EMAIL rows under that source —
    // counting them would double the engine's fatigue signal and count bounces as contact.
    List<EmailLedgerRow> aggregateEmailLedger(
            @Param("instituteId") String instituteId,
            @Param("emails") List<String> emails,
            @Param("recentSince") Instant recentSince);
}
