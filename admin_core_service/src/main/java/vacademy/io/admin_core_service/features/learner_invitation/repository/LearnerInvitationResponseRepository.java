package vacademy.io.admin_core_service.features.learner_invitation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.learner_invitation.entity.LearnerInvitationResponse;

import java.util.List;
import java.util.Optional;

public interface LearnerInvitationResponseRepository extends JpaRepository<LearnerInvitationResponse, String> {
    Optional<LearnerInvitationResponse> findByEmailAndLearnerInvitationIdAndStatusIn(
            String email,
            String learnerInvitationId,
            List<String> status
    );
}
