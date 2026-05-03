package vacademy.io.auth_service.feature.auth.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.auth.dto.VimotionRequestOtpRequest;
import vacademy.io.auth_service.feature.auth.dto.VimotionSignupRequest;
import vacademy.io.auth_service.feature.auth.dto.VimotionVerifyOtpRequest;
import vacademy.io.auth_service.feature.auth.dto.VimotionVerifyOtpResponse;
import vacademy.io.auth_service.feature.auth.manager.VimotionAuthManager;

@RestController
@RequestMapping("/auth-service/v1/vimotion")
public class VimotionAuthController {

    @Autowired
    private VimotionAuthManager vimotionAuthManager;

    @PostMapping("/request-signup-otp")
    public String requestSignupOtp(@RequestBody VimotionRequestOtpRequest request) {
        return vimotionAuthManager.requestSignupOtp(request == null ? null : request.getPhoneNumber());
    }

    @PostMapping("/verify-signup-otp")
    public VimotionVerifyOtpResponse verifySignupOtp(@RequestBody VimotionVerifyOtpRequest request) {
        return vimotionAuthManager.verifySignupOtp(request);
    }

    @PostMapping("/signup")
    public JwtResponseDto signup(@RequestBody VimotionSignupRequest request) {
        return vimotionAuthManager.signup(request);
    }
}
