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
                                             @RequestAttribute("user") CustomUserDetails customUserDetails) {
        String response = inviteUserService.inviteUser(userDTO, instituteId, customUserDetails);
        return ResponseEntity.ok(response);
    }


    @PostMapping("/resend-invitation")
    public ResponseEntity<String> resendInvitation(@RequestParam String userId,
                                                    @RequestAttribute("user") CustomUserDetails customUserDetails) {
        String response = inviteUserService.resendInvitation(userId, customUserDetails);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/update")
    public ResponseEntity<String> updateInvitationUser(@RequestBody UserDTO user,
                                                   @RequestParam String instituteId,
                                                   @RequestAttribute("user") CustomUserDetails customUserDetails) {
        String response = inviteUserService.updateInvitationUser(user,instituteId, customUserDetails);
        return ResponseEntity.ok(response);
    }

}
