package vacademy.io.admin_core_service.features.live_session.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.live_session.manager.EmailVerificationManager;
import vacademy.io.admin_core_service.features.live_session.service.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.notification.dto.EmailOTPRequest;

@RestController
@RequestMapping("/admin-core-service/live-session/email-verification")
@RequiredArgsConstructor
public class EmailVerification {

    private final GetRegistrationDataService getRegistrationFromResponseDTO;
    private final EmailVerificationManager emailVerificationManager;

    @GetMapping("/send-otp")
    ResponseEntity<String> sendOtp(@RequestParam("email") String Email) {
        return ResponseEntity.ok(emailVerificationManager.requestOtp(Email));

    }
    @PostMapping("/verify-otp")
    ResponseEntity<Boolean> verifyOtp(@RequestBody EmailOTPRequest emailOTPRequest , @RequestParam("sessionId") String sessionId) {
     return ResponseEntity.ok(emailVerificationManager.verifyOTP(emailOTPRequest , sessionId));
    }
}
