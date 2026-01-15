package vacademy.io.admin_core_service.features.enroll_invite.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteWithSessionsProjection;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Repository
public interface EnrollInviteRepository extends JpaRepository<EnrollInvite, String> {

    Optional<EnrollInvite> findByInviteCode(String inviteCode);

    @Modifying
    @Transactional
    @Query("UPDATE EnrollInvite ei SET ei.status = :status WHERE ei.id IN :enrollInviteIds")
    void updateStatusByIds(@Param("enrollInviteIds") List<String> enrollInviteIds, @Param("status") String status);

    @Query(value = """
    SELECT
        ei.id AS id,
        ei.name AS name,
        ei.start_date AS startDate,
        ei.end_date AS endDate,
        ei.invite_code AS inviteCode,
        ei.status AS status,
        ei.institute_id AS instituteId,
        ei.vendor AS vendor,
        ei.vendor_id AS vendorId,
        ei.currency AS currency,
        ei.tag AS tag,
        ei.web_page_meta_data_json AS webPageMetaDataJson,
        ei.created_at AS createdAt,
        ei.updated_at AS updatedAt,
        (
            SELECT ARRAY_REMOVE(ARRAY_AGG(DISTINCT ps.id), NULL)
            FROM package_session_learner_invitation_to_payment_option psl
            JOIN package_session ps ON ps.id = psl.package_session_id
            WHERE psl.enroll_invite_id = ei.id
              AND psl.status != 'DELETED'
              AND (:#{#packageSessionStatuses == null || #packageSessionStatuses.isEmpty()} = true OR ps.status IN (:packageSessionStatuses))
              AND (:#{#packageSessionIds == null || #packageSessionIds.isEmpty()} = true OR ps.id IN (:packageSessionIds))
        ) AS "packageSessionIds"
    FROM enroll_invite ei
    WHERE ei.institute_id = :instituteId
      AND (:#{#tags == null || #tags.isEmpty()} = true OR ei.tag IN (:tags))
      AND (:#{#enrollInviteStatus == null || #enrollInviteStatus.isEmpty()} = true OR ei.status IN (:enrollInviteStatus))
      AND (:#{#packageSessionIds == null || #packageSessionIds.isEmpty()} = true OR EXISTS (
          SELECT 1 FROM package_session_learner_invitation_to_payment_option psl
          WHERE psl.enroll_invite_id = ei.id AND psl.package_session_id IN (:packageSessionIds) AND psl.status != 'DELETED'
      ))
      AND (:#{#paymentOptionIds == null || #paymentOptionIds.isEmpty()} = true OR EXISTS (
          SELECT 1 FROM package_session_learner_invitation_to_payment_option psl
          WHERE psl.enroll_invite_id = ei.id AND psl.payment_option_id IN (:paymentOptionIds) AND psl.status != 'DELETED'
      ))
    """,
            countQuery = """
    SELECT COUNT(*)
    FROM enroll_invite ei
    WHERE ei.institute_id = :instituteId
      AND (:#{#tags == null || #tags.isEmpty()} = true OR ei.tag IN (:tags))
      AND (:#{#enrollInviteStatus == null || #enrollInviteStatus.isEmpty()} = true OR ei.status IN (:enrollInviteStatus))
      AND (:#{#packageSessionIds == null || #packageSessionIds.isEmpty()} = true OR EXISTS (
          SELECT 1 FROM package_session_learner_invitation_to_payment_option psl
          WHERE psl.enroll_invite_id = ei.id AND psl.package_session_id IN (:packageSessionIds) AND psl.status != 'DELETED'
      ))
      AND (:#{#paymentOptionIds == null || #paymentOptionIds.isEmpty()} = true OR EXISTS (
          SELECT 1 FROM package_session_learner_invitation_to_payment_option psl
          WHERE psl.enroll_invite_id = ei.id AND psl.payment_option_id IN (:paymentOptionIds) AND psl.status != 'DELETED'
      ))
    """,
            nativeQuery = true)
    Page<EnrollInviteWithSessionsProjection> getEnrollInvitesWithFilters(
            @Param("instituteId") String instituteId,
            @Param("packageSessionIds") List<String> packageSessionIds,
            @Param("paymentOptionIds") List<String> paymentOptionIds,
            @Param("tags") List<String> tags,
            @Param("enrollInviteStatus") List<String> enrollInviteStatus,
            @Param("packageSessionStatuses") List<String> packageSessionStatuses,
            Pageable pageable
    );

    @Query(value = "SELECT " +
            "ei.id as \"id\", ei.name as \"name\", ei.end_date as \"endDate\", ei.start_date as \"startDate\", ei.invite_code as \"inviteCode\", " +
            "ei.status as \"status\", ei.institute_id as \"instituteId\", ei.vendor as \"vendor\", ei.vendor_id as \"vendorId\", " +
            "ei.currency as \"currency\", ei.tag as \"tag\", ei.web_page_meta_data_json as \"webPageMetaDataJson\", " +
            "ei.created_at as \"createdAt\", ei.updated_at as \"updatedAt\", " +
            "ARRAY_REMOVE(ARRAY_AGG(DISTINCT ps.id), NULL) as \"packageSessionIds\" " +
            "FROM enroll_invite ei " +
            "LEFT JOIN package_session_learner_invitation_to_payment_option psl ON ei.id = psl.enroll_invite_id " +
            "LEFT JOIN package_session ps ON psl.package_session_id = ps.id " +
            "WHERE ei.institute_id = :instituteId " +
            "AND (COALESCE(:enrollInviteStatus, NULL) IS NULL OR ei.status IN (:enrollInviteStatus)) " +
            "AND (:searchName IS NULL OR :searchName = '' OR " +
            "     LOWER(ei.name) LIKE LOWER(CONCAT('%', :searchName, '%')) OR " +
            "     LOWER(ei.invite_code) LIKE LOWER(CONCAT('%', :searchName, '%'))) " +
            "AND (COALESCE(:packageSessionStatuses, NULL) IS NULL OR ps.status IN (:packageSessionStatuses)) " +
            "GROUP BY ei.id",
            countQuery = "SELECT COUNT(DISTINCT ei.id) FROM enroll_invite ei " +
                    "LEFT JOIN package_session_learner_invitation_to_payment_option psl ON ei.id = psl.enroll_invite_id " +
                    "LEFT JOIN package_session ps ON psl.package_session_id = ps.id " +
                    "WHERE ei.institute_id = :instituteId " +
                    "AND (COALESCE(:enrollInviteStatus, NULL) IS NULL OR ei.status IN (:enrollInviteStatus)) " +
                    "AND (:searchName IS NULL OR :searchName = '' OR " +
                    "     LOWER(ei.name) LIKE LOWER(CONCAT('%', :searchName, '%')) OR " +
                    "     LOWER(ei.invite_code) LIKE LOWER(CONCAT('%', :searchName, '%'))) " +
                    "AND (COALESCE(:packageSessionStatuses, NULL) IS NULL OR ps.status IN (:packageSessionStatuses))",
            nativeQuery = true)
    Page<EnrollInviteWithSessionsProjection> getEnrollInvitesByInstituteIdAndSearchName(
            @Param("instituteId") String instituteId,
            @Param("searchName") String searchName,
            @Param("enrollInviteStatus") List<String> enrollInviteStatus,
            @Param("packageSessionStatuses") List<String> packageSessionStatuses,
            Pageable pageable
    );

    @Query(value = """
        SELECT ei.*
        FROM enroll_invite ei
        INNER JOIN package_session_learner_invitation_to_payment_option m
            ON m.enroll_invite_id = ei.id
        WHERE m.package_session_id = :packageSessionId
          AND ei.status IN (:enrollInviteStatusList)
          AND ei.tag IN (:tagList)
          AND m.status IN (:mappingStatusList)
        ORDER BY ei.created_at DESC
        LIMIT 1
    """, nativeQuery = true)
    Optional<EnrollInvite> findLatestForPackageSessionWithFilters(
            @Param("packageSessionId") String packageSessionId,
            @Param("enrollInviteStatusList") List<String> enrollInviteStatusList,
            @Param("tagList") List<String> tagList,
            @Param("mappingStatusList") List<String> mappingStatusList
    );

    @Query("SELECT ei FROM EnrollInvite ei " +
            "WHERE ei.status IN :statusList " +
            "AND ei.instituteId = :instituteId " +
            "AND ei.inviteCode = :inviteCode")
    Optional<EnrollInvite> findValidEnrollInvite(
            @Param("statusList") List<String> statusList,
            @Param("instituteId") String instituteId,
            @Param("inviteCode") String inviteCode);

    @Query(value = """
    SELECT DISTINCT ei.*
    FROM enroll_invite ei
    INNER JOIN package_session_learner_invitation_to_payment_option pslipo
        ON pslipo.enroll_invite_id = ei.id
    INNER JOIN student_session_institute_group_mapping ssigm
        ON ssigm.package_session_id = pslipo.package_session_id
    WHERE ssigm.user_id = :userId
      AND ssigm.institute_id = :instituteId
      AND ssigm.status IN (:ssigmActiveStatuses)
      AND pslipo.status IN (:packageSessionMappingActiveStatuses)
      AND ei.status IN (:enrollInviteActiveStatuses)
      AND ei.tag = 'DEFAULT'
    ORDER BY ei.created_at DESC
""", nativeQuery = true)
    List<EnrollInvite> findDefaultEnrollInvitesForStudent(
            @Param("userId") String userId,
            @Param("instituteId") String instituteId,
            @Param("ssigmActiveStatuses") List<String> ssigmActiveStatuses,
            @Param("enrollInviteActiveStatuses") List<String> enrollInviteActiveStatuses,
            @Param("packageSessionMappingActiveStatuses") List<String> packageSessionMappingActiveStatuses
    );
}
