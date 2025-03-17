package vacademy.io.admin_core_service.features.learner_invitation.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.learner_invitation.entity.LearnerInvitationResponse;

import java.util.List;
import java.util.Optional;

public interface LearnerInvitationResponseRepository extends JpaRepository<LearnerInvitationResponse, String> {
    Optional<LearnerInvitationResponse> findByEmailAndLearnerInvitationIdAndStatusIn(
            String email,
            String learnerInvitationId,
            List<String> status
    );

    @Query("SELECT lir FROM LearnerInvitationResponse lir " +
            "LEFT JOIN FETCH lir.customFieldsResponse lircfr " +
            "LEFT JOIN FETCH lircfr.customField cf " +  // Ensuring field_name is fetched
            "WHERE lir.instituteId = :instituteId AND lir.status IN :status")
    Page<LearnerInvitationResponse> findByInstituteIdAndStatusWithCustomFields(
            @Param("instituteId") String instituteId,
            @Param("status") List<String> status,
            Pageable pageable);
}
