package vacademy.io.admin_core_service.features.enroll_invite.controller;

import org.checkerframework.checker.units.qual.A;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteDTO;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteService;

@RestController
@RequestMapping("/admin-core-service/v1/enroll-invite")
public class EnrollInviteController {
    @Autowired
    private EnrollInviteService enrollInviteService;

    @PostMapping
    public ResponseEntity<String>createEnrollInvite(@RequestBody EnrollInviteDTO enrollInviteDTO) {
        return ResponseEntity.ok(enrollInviteService.createEnrollInvite(enrollInviteDTO));
    }
}
