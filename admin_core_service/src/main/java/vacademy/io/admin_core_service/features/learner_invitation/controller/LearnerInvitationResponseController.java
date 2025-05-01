package vacademy.io.admin_core_service.features.learner_invitation.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationFormDTO;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationResponseDTO;
import vacademy.io.admin_core_service.features.learner_invitation.services.LearnerInvitationResponseService;
import vacademy.io.admin_core_service.features.learner_invitation.services.LearnerInvitationService;

@RequestMapping("/admin-core-service/learner-invitation-response")
@RestController
public class LearnerInvitationResponseController {
    @Autowired
    private LearnerInvitationResponseService learnerInvitationResponseService;

    @Autowired
    private LearnerInvitationService learnerInvitationService;

    @GetMapping("/form")
    public ResponseEntity<LearnerInvitationFormDTO> getInvitationFormByInviteCodeAndInstituteId(
            @RequestParam String instituteId,
            @RequestParam String inviteCode) {

        LearnerInvitationFormDTO invitationDTO = learnerInvitationResponseService.getInvitationFormByInviteCodeAndInstituteId(instituteId, inviteCode);
        return ResponseEntity.ok(invitationDTO);
    }

    @PostMapping("/record")
    public ResponseEntity<String> registerLearnerInvitationResponse(@RequestBody LearnerInvitationResponseDTO learnerInvitationResponseDTO) {
        String responseId = learnerInvitationResponseService.registerLearnerInvitationResponse(learnerInvitationResponseDTO);
        return ResponseEntity.ok(responseId);
    }
}
