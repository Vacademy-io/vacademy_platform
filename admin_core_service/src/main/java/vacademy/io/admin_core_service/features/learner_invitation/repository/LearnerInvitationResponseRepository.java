package vacademy.io.admin_core_service.features.learner_invitation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.learner_invitation.entity.LearnerInvitationResponse;

public interface LearnerInvitationResponseRepository extends JpaRepository<LearnerInvitationResponse, String> {
}
