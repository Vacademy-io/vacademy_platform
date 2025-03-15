package vacademy.io.admin_core_service.features.learner_invitation.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationResponseDTO;
import vacademy.io.admin_core_service.features.learner_invitation.services.LearnerInvitationResponseService;

@RequestMapping("/admin-core-service/learner-invitation-response")
@RestController
public class LearnerInvitationResponseController {
    @Autowired
    private LearnerInvitationResponseService learnerInvitationResponseService;

    @PostMapping("/record")
    public ResponseEntity<String> registerLearnerInvitationResponse(@RequestBody LearnerInvitationResponseDTO learnerInvitationResponseDTO) {
        String responseId = learnerInvitationResponseService.registerLearnerInvitationResponse(learnerInvitationResponseDTO);
        return ResponseEntity.ok(responseId);
    }
}
