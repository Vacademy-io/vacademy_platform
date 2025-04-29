package vacademy.io.admin_core_service.features.learner_invitation.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    Optional<LearnerInvitation> findTopBySourceIdAndSourceAndStatusInOrderByCreatedAtDesc(
            String sourceId,
            String source,
            List<String> status
    );

}
