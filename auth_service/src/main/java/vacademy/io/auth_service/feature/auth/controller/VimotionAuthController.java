package vacademy.io.auth_service.feature.auth.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.auth.dto.VimotionLoginRequest;
import vacademy.io.auth_service.feature.auth.dto.VimotionRequestOtpRequest;
import vacademy.io.auth_service.feature.auth.dto.VimotionSignupRequest;
import vacademy.io.auth_service.feature.auth.dto.VimotionVerifyOtpRequest;
import vacademy.io.auth_service.feature.auth.dto.VimotionVerifyOtpResponse;
import vacademy.io.auth_service.feature.auth.manager.VimotionAuthManager;
import vacademy.io.auth_service.feature.vimotion.dto.ValidateInviteCodeRequest;
import vacademy.io.auth_service.feature.vimotion.dto.ValidateInviteCodeResponse;
import vacademy.io.auth_service.feature.vimotion.dto.VimotionConfigResponse;
import vacademy.io.auth_service.feature.vimotion.entity.InviteCode;
import vacademy.io.auth_service.feature.vimotion.service.InviteCodeService;

@RestController
@RequestMapping("/auth-service/v1/vimotion")
public class VimotionAuthController {

    @Autowired
    private VimotionAuthManager vimotionAuthManager;

    @Autowired
    private InviteCodeService inviteCodeService;

    @Value("${vimotion.invite-only.enabled:false}")
    private boolean inviteOnlyEnabled;

    @PostMapping("/request-signup-otp")
    public String requestSignupOtp(@RequestBody VimotionRequestOtpRequest request) {
        return vimotionAuthManager.requestSignupOtp(request);
    }

    @PostMapping("/verify-signup-otp")
    public VimotionVerifyOtpResponse verifySignupOtp(@RequestBody VimotionVerifyOtpRequest request) {
        return vimotionAuthManager.verifySignupOtp(request);
    }

    @PostMapping("/signup")
    public JwtResponseDto signup(@RequestBody VimotionSignupRequest request) {
        return vimotionAuthManager.signup(request);
    }

    @PostMapping("/login")
    public JwtResponseDto login(@RequestBody VimotionLoginRequest request) {
        return vimotionAuthManager.login(request);
    }

    @PostMapping("/invite-codes/validate")
    public ValidateInviteCodeResponse validateInviteCode(@RequestBody ValidateInviteCodeRequest request) {
        InviteCode code = inviteCodeService.validateByCode(request == null ? null : request.getCode());
        return ValidateInviteCodeResponse.builder()
                .valid(true)
                .kind(code.getKind())
                .prefillEmail(InviteCode.KIND_LOCKED.equals(code.getKind()) ? code.getLockedEmail() : null)
                .prefillPhone(InviteCode.KIND_LOCKED.equals(code.getKind()) ? code.getLockedPhoneNumber() : null)
                .build();
    }

    @GetMapping("/config")
    public VimotionConfigResponse config() {
        return VimotionConfigResponse.builder()
                .inviteOnly(inviteOnlyEnabled)
                .build();
    }
}
