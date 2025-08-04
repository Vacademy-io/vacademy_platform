package vacademy.io.admin_core_service.features.enroll_invite.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteDTO;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteService;
import vacademy.io.admin_core_service.features.enroll_invite.service.LearnerEnrollInviteService;

@RestController
@RequestMapping("/admin-core-service/open/learner/enroll-invite")
public class OpenLearnerEnrollInviteController {


    @Autowired
    private LearnerEnrollInviteService learnerEnrollInviteService;


    @GetMapping
    public ResponseEntity<EnrollInviteDTO>getEnrollInvite(String instituteId,String inviteCode) {
        return ResponseEntity.ok(learnerEnrollInviteService.getEnrollInvite(instituteId, inviteCode));
    }
}
