package vacademy.io.auth_service.feature.user.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.user.service.UserOperationService;
import vacademy.io.common.auth.dto.UserCredentials;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/auth-service/v1/user-operation")
public class UserOperationController {

    @Autowired
    private UserOperationService userOperationService;

    @PostMapping("/send-passwords")
    public ResponseEntity<String> sendUserPasswords(
            @RequestBody List<String> userIds,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(userOperationService.sendUserPasswords(userIds, userDetails));
    }

    @PostMapping("/update-password")
    public ResponseEntity<String> updatePassword(
            @RequestBody UserCredentials userCredentials,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(userOperationService.updateUserPassword(userCredentials, userDetails));
    }
}
