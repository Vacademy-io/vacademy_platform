package vacademy.io.notification_service.features.analytics.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.analytics.entity.NotificationTemplateDayMap;

import java.util.List;

/**
 * Repository for NotificationTemplateDayMap entity
 * Queries notification_log table for analytics
 */
@Repository
public interface NotificationTemplateDayMapRepository extends JpaRepository<NotificationTemplateDayMap, String> {

    /**
     * Find all active template mappings for an institute
     */
    List<NotificationTemplateDayMap> findByInstituteIdAndIsActiveOrderByDayNumberAsc(String instituteId, Boolean isActive);

    /**
     * Get outgoing message metrics (templates sent to users)
     * 
     * @param instituteId Institute ID
     * @param startDate Start date filter (empty string for no filter)
     * @param endDate End date filter (empty string for no filter)
     * @return List of Object arrays containing:
     *         [0] day_number (Integer)
     *         [1] day_label (String)
     *         [2] template_identifier (String)
     *         [3] sub_template_label (String)
     *         [4] unique_users (Long)
     *         [5] total_messages (Long)
     */
    @Query(value = """
        SELECT 
            ntdm.day_number,
            ntdm.day_label,
            ntdm.template_identifier,
            ntdm.sub_template_label,
            COALESCE(COUNT(DISTINCT nl.user_id), 0) as unique_users,
            COALESCE(COUNT(nl.id), 0) as total_messages
        FROM notification_template_day_map ntdm
        LEFT JOIN notification_log nl
            ON ntdm.sender_business_channel_id = nl.sender_business_channel_id
            AND nl.body LIKE '%' || ntdm.template_identifier || '%'
            AND nl.notification_type = ntdm.notification_type
            AND (COALESCE(:startDate, '') = '' OR nl.created_at >= CAST(:startDate AS TIMESTAMP))
            AND (COALESCE(:endDate, '') = '' OR nl.created_at <= CAST(:endDate AS TIMESTAMP))
        WHERE ntdm.institute_id = CAST(:instituteId AS uuid)
            AND ntdm.notification_type = 'WHATSAPP_MESSAGE_OUTGOING'
            AND ntdm.is_active = true
        GROUP BY ntdm.day_number, ntdm.day_label, ntdm.template_identifier, ntdm.sub_template_label
        ORDER BY ntdm.day_number, ntdm.template_identifier
        """, nativeQuery = true)
    List<Object[]> getOutgoingMessageMetrics(
            @Param("instituteId") String instituteId,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate
    );

    /**
     * Get incoming message metrics (user responses)
     * 
     * @param instituteId Institute ID
     * @param startDate Start date filter (empty string for no filter)
     * @param endDate End date filter (empty string for no filter)
     * @return List of Object arrays containing:
     *         [0] day_number (Integer)
     *         [1] day_label (String)
     *         [2] template_identifier (String)
     *         [3] sub_template_label (String)
     *         [4] unique_users (Long)
     *         [5] total_messages (Long)
     */
    @Query(value = """
        SELECT 
            ntdm.day_number,
            ntdm.day_label,
            ntdm.template_identifier,
            ntdm.sub_template_label,
            COALESCE(COUNT(DISTINCT nl.user_id), 0) as unique_users,
            COALESCE(COUNT(nl.id), 0) as total_messages
        FROM notification_template_day_map ntdm
        LEFT JOIN notification_log nl
            ON ntdm.sender_business_channel_id = nl.sender_business_channel_id
            AND nl.body LIKE '%' || ntdm.template_identifier || '%'
            AND nl.notification_type = ntdm.notification_type
            AND (COALESCE(:startDate, '') = '' OR nl.created_at >= CAST(:startDate AS TIMESTAMP))
            AND (COALESCE(:endDate, '') = '' OR nl.created_at <= CAST(:endDate AS TIMESTAMP))
        WHERE ntdm.institute_id = CAST(:instituteId AS uuid)
            AND ntdm.notification_type = 'WHATSAPP_MESSAGE_INCOMING'
            AND ntdm.is_active = true
        GROUP BY ntdm.day_number, ntdm.day_label, ntdm.template_identifier, ntdm.sub_template_label
        ORDER BY ntdm.day_number, ntdm.template_identifier
        """, nativeQuery = true)
    List<Object[]> getIncomingMessageMetrics(
            @Param("instituteId") String instituteId,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate
    );

    /**
     * Get all outgoing template identifiers grouped by day for an institute
     * Returns only WHATSAPP_MESSAGE_OUTGOING templates
     * 
     * @param instituteId Institute ID
     * @return List of Object arrays containing:
     *         [0] day_number (Integer)
     *         [1] day_label (String)
     *         [2] template_identifier (String)
     */
    @Query(value = """
        SELECT DISTINCT
            ntdm.day_number,
            ntdm.day_label,
            ntdm.template_identifier
        FROM notification_template_day_map ntdm
        WHERE ntdm.institute_id = CAST(:instituteId AS uuid)
            AND ntdm.notification_type = 'WHATSAPP_MESSAGE_OUTGOING'
            AND ntdm.is_active = true
        ORDER BY ntdm.day_number, ntdm.template_identifier
        """, nativeQuery = true)
    List<Object[]> getOutgoingTemplatesByInstitute(@Param("instituteId") String instituteId);
}
