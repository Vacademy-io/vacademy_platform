package vacademy.io.admin_core_service.features.learner_invitation.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.learner_invitation.dto.InvitationDetailProjection;
import vacademy.io.admin_core_service.features.learner_invitation.entity.LearnerInvitation;

import java.util.List;
import java.util.Optional;

public interface LearnerInvitationRepository extends JpaRepository<LearnerInvitation, String> {
    @Query("""
                SELECT li.id AS id, 
                       li.name AS name, 
                       li.instituteId AS instituteId, 
                       li.dateGenerated AS dateGenerated,
                       li.inviteCode AS inviteCode,
                       COUNT(lir.id) AS acceptedBy
                FROM LearnerInvitation li
                LEFT JOIN LearnerInvitationResponse lir 
                       ON li.id = lir.learnerInvitation.id 
                       AND lir.status IN :learnerInvitationResponseStatus
                WHERE li.instituteId = :instituteId 
                  AND li.status IN :learnerInvitationStatus
                GROUP BY li.id, li.name, li.instituteId, li.dateGenerated
                ORDER BY li.dateGenerated DESC
            """)
    Page<InvitationDetailProjection> findInvitationsWithAcceptedCount(
            @Param("instituteId") String instituteId,
            @Param("learnerInvitationStatus") List<String> learnerInvitationStatus,
            @Param("learnerInvitationResponseStatus") List<String> learnerInvitationResponseStatus,
            Pageable pageable);

    @Query(""" 
                SELECT li.id AS id, 
                       li.name AS name, 
                       li.instituteId AS instituteId, 
                       li.dateGenerated AS dateGenerated,
                       li.inviteCode AS inviteCode,
                       COUNT(lir.id) AS acceptedBy
                FROM LearnerInvitation li
                LEFT JOIN LearnerInvitationResponse lir 
                       ON li.id = lir.learnerInvitation.id 
                       AND lir.status IN :learnerInvitationResponseStatus
                WHERE li.instituteId = :instituteId 
                  AND li.status IN :learnerInvitationStatus
                  AND LOWER(li.name) LIKE LOWER(CONCAT('%', :name, '%'))
                GROUP BY li.id, li.name, li.instituteId, li.dateGenerated
                ORDER BY li.dateGenerated DESC
            """)
    Page<InvitationDetailProjection> findInvitationsWithAcceptedCountByName(
            @Param("instituteId") String instituteId,
            @Param("learnerInvitationStatus") List<String> learnerInvitationStatus,
            @Param("learnerInvitationResponseStatus") List<String> learnerInvitationResponseStatus,
            @Param("name") String name,
            Pageable pageable
    );

    @Query("SELECT DISTINCT li FROM LearnerInvitation li " +
            "LEFT JOIN FETCH li.customFields cf " +
            "WHERE li.instituteId = :instituteId " +
            "AND li.inviteCode = :inviteCode " +
            "AND li.status IN :status " +
            "AND cf.status IN :customFieldStatus")
    Optional<LearnerInvitation> findByInstituteIdAndInviteCodeAndStatus(
            @Param("instituteId") String instituteId,
            @Param("inviteCode") String inviteCode,
            @Param("status") List<String> status,
            @Param("customFieldStatus") List<String> customFieldStatus);

    @Modifying
    @Transactional
    @Query("UPDATE LearnerInvitation li SET li.status = :status WHERE li.sourceId IN :sourceIds AND li.source = :source")
    int updateStatusBySourceIdsAndSource(@Param("status") String status,
                                         @Param("sourceIds") List<String> sourceIds,
                                         @Param("source") String source);

    @Query(value = """
    SELECT li.*, 
           cf.id AS cf_id, cf.field_name, cf.field_type, cf.comma_separated_options, 
           cf.is_mandatory, cf.description, cf.default_value, cf.status AS cf_status, 
           cf.field_order, cf.learner_invitation_id, cf.created_at AS cf_created_at, cf.updated_at AS cf_updated_at
    FROM learner_invitation li
    LEFT JOIN learner_invitation_custom_field cf 
        ON li.id = cf.learner_invitation_id
        AND (cf.status IS NULL OR cf.status IN (:statusList))
    WHERE li.id = :invitationId
    ORDER BY cf.field_order ASC
""", nativeQuery = true)
    Optional<LearnerInvitation> findByIdWithFilteredCustomFields(
            @Param("invitationId") String invitationId,
            @Param("statusList") List<String> statusList
    );
}
