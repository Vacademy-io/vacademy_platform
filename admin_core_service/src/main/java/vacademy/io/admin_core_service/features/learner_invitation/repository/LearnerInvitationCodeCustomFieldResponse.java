package vacademy.io.admin_core_service.features.learner_invitation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.learner_invitation.entity.LearnerInvitationCustomFieldResponse;

public interface LearnerInvitationCodeCustomFieldResponse extends JpaRepository<LearnerInvitationCustomFieldResponse,String> {
}
