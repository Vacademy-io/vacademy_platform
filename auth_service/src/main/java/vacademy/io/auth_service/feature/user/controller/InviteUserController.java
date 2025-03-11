package vacademy.io.auth_service.feature.user.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.user.service.InviteUserService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("auth-service/v1/user-invitation")
@RequiredArgsConstructor
public class InviteUserController {

    private final InviteUserService inviteUserService;

    @PostMapping("/invite")
    public ResponseEntity<String> inviteUser(@RequestBody UserDTO userDTO,
                                             @RequestParam String instituteId,
                                             @RequestParam String instituteName,
                                             @RequestAttribute("user") CustomUserDetails customUserDetails) {
        String response = inviteUserService.inviteUser(userDTO, instituteId,instituteName, customUserDetails);
        return ResponseEntity.ok(response);
    }


    @PostMapping("/resend-invitation")
    public ResponseEntity<String> resendInvitation(@RequestParam String userId,
                                                    @RequestParam String instituteName,
                                                    @RequestAttribute("user") CustomUserDetails customUserDetails) {
        String response = inviteUserService.resendInvitation(userId, instituteName, customUserDetails);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/update")
    public ResponseEntity<String> updateInvitationUser(@RequestBody UserDTO user,
                                                   @RequestParam String instituteName,
                                                   @RequestParam String instituteId,
                                                   @RequestAttribute("user") CustomUserDetails customUserDetails) {
        String response = inviteUserService.updateInvitationUser(user, instituteName,instituteId, customUserDetails);
        return ResponseEntity.ok(response);
    }

}
