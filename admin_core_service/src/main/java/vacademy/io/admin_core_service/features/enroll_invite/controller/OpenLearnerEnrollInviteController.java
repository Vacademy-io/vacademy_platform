package vacademy.io.admin_core_service.features.enroll_invite.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PostMapping;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteDTO;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteService;
import vacademy.io.admin_core_service.features.enroll_invite.service.LearnerEnrollInviteService;

@RestController
@RequestMapping("/admin-core-service/open/learner/enroll-invite")
public class OpenLearnerEnrollInviteController {

    @Autowired
    private LearnerEnrollInviteService learnerEnrollInviteService;

    @Autowired
    private EnrollInviteService enrollInviteService;

    @GetMapping
    public ResponseEntity<EnrollInviteDTO> getEnrollInvite(String instituteId, String inviteCode) {
        return ResponseEntity.ok(learnerEnrollInviteService.getEnrollInvite(instituteId, inviteCode));
    }

    @GetMapping("/{instituteId}/{enrollInviteId}")
    public ResponseEntity<EnrollInviteDTO> getEnrollInviteById(@PathVariable("instituteId") String instituteId,
            @PathVariable("enrollInviteId") String enrollInviteId) {
        return ResponseEntity.ok(enrollInviteService.findByEnrollInviteId(enrollInviteId, instituteId));
    }

    @PostMapping("/capture-lead")
    public ResponseEntity<String> captureLead(
            @org.springframework.web.bind.annotation.RequestBody vacademy.io.admin_core_service.features.enroll_invite.dto.LeadCaptureRequestDTO request) {
        return ResponseEntity.ok(learnerEnrollInviteService.captureLead(request));
    }
}
