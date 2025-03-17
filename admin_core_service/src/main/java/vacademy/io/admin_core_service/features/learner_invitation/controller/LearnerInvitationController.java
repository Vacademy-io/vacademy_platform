package vacademy.io.admin_core_service.features.learner_invitation.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_invitation.dto.InvitationDetailProjection;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationDTO;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationDetailFilterDTO;
import vacademy.io.admin_core_service.features.learner_invitation.services.LearnerInvitationService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/learner-invitation")
public class LearnerInvitationController {

    @Autowired
    private LearnerInvitationService learnerInvitationService;

    @PostMapping("/create")
    public ResponseEntity<String> createInvitation(@RequestBody LearnerInvitationDTO learnerInvitationDTO,
                                                   @RequestAttribute("user")CustomUserDetails user) {
        String invitationId = learnerInvitationService.createLearnerInvitationCode(learnerInvitationDTO,user);
        return ResponseEntity.ok(invitationId);
    }

    @PostMapping("/invitation-details")
    public Page<InvitationDetailProjection> getInvitationDetails(
            @RequestParam String instituteId,
            @RequestParam int pageNo,
            @RequestParam int pageSize,
            @RequestBody LearnerInvitationDetailFilterDTO filterDTO,
            @RequestAttribute("user") CustomUserDetails user) {

        return learnerInvitationService.getInvitationDetails(instituteId,filterDTO, pageNo, pageSize, user);
    }
}
