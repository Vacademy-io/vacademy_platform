package vacademy.io.admin_core_service.features.learner_invitation.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationCodeDTO;
import vacademy.io.admin_core_service.features.learner_invitation.services.LearnerInvitationService;

@RestController
@RequestMapping("/admin-core-service/learner-invitation")
public class LearnerInvitationController {

    @Autowired
    private LearnerInvitationService learnerInvitationService;

    @PostMapping("/create")
    public ResponseEntity<String> createInvitation(@RequestBody LearnerInvitationCodeDTO learnerInvitationCodeDTO) {
        String invitationId = learnerInvitationService.createLearnerInvitationCode(learnerInvitationCodeDTO);
        return ResponseEntity.ok(invitationId);
    }

}
