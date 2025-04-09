package vacademy.io.admin_core_service.features.notification.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.notification.entity.NotificationSetting;

import java.util.List;
import java.util.Optional;

public interface NotificationSettingRepository extends JpaRepository<NotificationSetting, String> {
    Optional<NotificationSetting> findBySourceAndSourceIdAndTypeAndStatusIn(
            String source,
            String sourceId,
             String type,
             List<String> statusList
    );

    @Query(
            value = """
    SELECT 
        i.id AS instituteId,
        i.name AS instituteName,
        json_build_object(
            'notificationSettings', (
                SELECT json_agg(json_build_object(
                    'id', ns_i.id,
                    'source', ns_i.source,
                    'sourceId', ns_i.source_id,
                    'type', ns_i.type,
                    'status', ns_i.status,
                    'commaSeparatedCommunicationTypes', ns_i.comma_separated_communication_types,
                    'commaSeparatedEmailIds', ns_i.comma_separated_email_ids,
                    'commaSeparatedMobileNumbers', ns_i.comma_separated_mobile_numbers,
                    'commaSeparatedRoles', ns_i.comma_separated_roles,
                    'daily', ns_i.daily,
                    'weekly', ns_i.weekly,
                    'monthly', ns_i.monthly
                ))
                FROM notification_setting ns_i
                WHERE 
                    ns_i.source = 'INSTITUTE'
                    AND ns_i.source_id = i.id
                    AND ns_i.status IN (:notificationStatuses)
                    AND ns_i.type IN (:notificationTypes)
                    AND (
                        (:frequency = 'DAILY' AND ns_i.daily = true) OR
                        (:frequency = 'WEEKLY' AND ns_i.weekly = true) OR
                        (:frequency = 'MONTHLY' AND ns_i.monthly = true)
                    )
            ),
            'packageSessions', (
                SELECT json_agg(json_build_object(
                    'batch', l.level_name || ' ' || p.package_name || ' (' || s.session_name || ')',
                    'packageSessionId', ps.id,
                    'students', (
                        SELECT json_agg(json_build_object(
                            'userId', st.user_id,
                            'fullName', st.full_name,
                            'parentEmail', st.parents_email,
                            'parentsMobileNumber', st.parents_mobile_number,
                            'notificationSettings', (
                                SELECT json_agg(json_build_object(
                                    'id', ns_s.id,
                                    'source', ns_s.source,
                                    'sourceId', ns_s.source_id,
                                    'type', ns_s.type,
                                    'status', ns_s.status,
                                    'commaSeparatedCommunicationTypes', ns_s.comma_separated_communication_types,
                                    'commaSeparatedEmailIds', ns_s.comma_separated_email_ids,
                                    'commaSeparatedMobileNumbers', ns_s.comma_separated_mobile_numbers,
                                    'commaSeparatedRoles', ns_s.comma_separated_roles,
                                    'daily', ns_s.daily,
                                    'weekly', ns_s.weekly,
                                    'monthly', ns_s.monthly
                                ))
                                FROM notification_setting ns_s
                                WHERE ns_s.source = 'LEARNER'
                                  AND ns_s.source_id = st.user_id
                                  AND ns_s.status IN (:notificationStatuses)
                                  AND ns_s.type IN (:notificationTypes)
                                  AND (
                                    (:frequency = 'DAILY' AND ns_s.daily = true) OR
                                    (:frequency = 'WEEKLY' AND ns_s.weekly = true) OR
                                    (:frequency = 'MONTHLY' AND ns_s.monthly = true)
                                  )
                            )
                        ))
                        FROM (
                            SELECT DISTINCT ssigm.user_id
                            FROM student_session_institute_group_mapping ssigm
                            WHERE ssigm.package_session_id = ps.id 
                              AND ssigm.institute_id = i.id
                              AND ssigm.status IN (:studentMappingStatuses)
                        ) student_user
                        JOIN student st ON st.user_id = student_user.user_id
                    )
                ))
                FROM package_session ps
                JOIN package p ON ps.package_id = p.id
                JOIN level l ON ps.level_id = l.id
                JOIN session s ON ps.session_id = s.id
                JOIN package_institute pi ON pi.package_id = p.id AND pi.institute_id = i.id
                WHERE ps.status IN (:packageSessionStatuses)
            )
        ) AS instituteData
    FROM institutes i
    WHERE EXISTS (
        SELECT 1 FROM notification_setting ns
        WHERE ns.status IN (:notificationStatuses)
        AND ns.type IN (:notificationTypes)
        AND (
            (ns.source = 'INSTITUTE' AND ns.source_id = i.id)
            OR (ns.source = 'LEARNER' AND ns.source_id IN (
                SELECT ssigm.user_id
                FROM student_session_institute_group_mapping ssigm
                JOIN package_session ps ON ssigm.package_session_id = ps.id
                JOIN package_institute pi ON ps.package_id = pi.package_id
                WHERE pi.institute_id = i.id
                AND ssigm.status IN (:studentMappingStatuses)
                AND ps.status IN (:packageSessionStatuses)
            ))
        )
        AND (
            (:frequency = 'DAILY' AND ns.daily = true)
            OR (:frequency = 'WEEKLY' AND ns.weekly = true)
            OR (:frequency = 'MONTHLY' AND ns.monthly = true)
        )
    )
    """,
            nativeQuery = true
    )
    List<Object[]> fetchDynamicInstitutesWithSettings(
            @Param("frequency") String frequency,
            @Param("packageSessionStatuses") List<String> packageSessionStatuses,
            @Param("notificationTypes") List<String> notificationTypes,
            @Param("studentMappingStatuses") List<String> studentMappingStatuses,
            @Param("notificationStatuses") List<String> notificationStatuses
    );



}
