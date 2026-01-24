package vacademy.io.auth_service.feature.auth.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.auth.dto.AuthRequestDto;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.auth.dto.RegisterRequest;
import vacademy.io.auth_service.feature.auth.manager.AuthManager;
import vacademy.io.auth_service.feature.auth.service.PasswordResetManager;
import vacademy.io.common.auth.dto.RefreshTokenRequestDTO;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.service.JwtService;
import vacademy.io.common.auth.service.RefreshTokenService;

@RestController
@RequestMapping("/auth-service/v1")
public class AuthController {

    @Autowired
    AuthenticationManager authenticationManager;

    @Autowired
    UserRepository userRepository;

    @Autowired
    JwtService jwtService;

    @Autowired
    RefreshTokenService refreshTokenService;

    @Autowired
    AuthManager authManager;

    @Autowired
    private PasswordResetManager passwordResetManager;

    @PostMapping("/signup-root")
    public JwtResponseDto registerUser(@RequestBody RegisterRequest registerRequest) {

        return authManager.registerRootUser(registerRequest);

    }

    @PostMapping("/login-root")
    public JwtResponseDto authenticateAndGetToken(@RequestBody AuthRequestDto authRequestDTO) {

        return authManager.loginUser(authRequestDTO);
    }

    @PostMapping("/refresh-token")
    public JwtResponseDto refreshToken(@RequestBody RefreshTokenRequestDTO refreshTokenRequestDTO) {
        return authManager.refreshToken(refreshTokenRequestDTO);
    }

    @PostMapping("/send-password")
    public ResponseEntity<String> sendPassword(@RequestParam String email,
            @RequestParam(required = false) String clientName) {
        String response = passwordResetManager.sendPasswordToUser(email, clientName);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/request-otp")
    public String requestOtp(@RequestBody AuthRequestDto authRequestDTO) {
        return authManager.requestOtp(authRequestDTO);
    }

    @PostMapping("/login-otp")
    public JwtResponseDto loginViaOtp(@RequestBody AuthRequestDto authRequestDTO) {
        return authManager.loginViaOtp(authRequestDTO);
    }

    @PostMapping("/request-whatsapp-otp")
    public String requestWhatsAppOtp(@RequestBody AuthRequestDto authRequestDTO) {
        return authManager.requestWhatsAppOtp(authRequestDTO);
    }

    @PostMapping("/login-whatsapp-otp")
    public JwtResponseDto loginViaWhatsAppOtp(@RequestBody AuthRequestDto authRequestDTO) {
        return authManager.loginViaWhatsAppOtp(authRequestDTO);
    }

    /**
     * Request WhatsApp OTP without user validation.
     * Use this for generic verification scenarios (guest checkout, lead
     * verification, etc.)
     */
    @PostMapping("/request-generic-whatsapp-otp")
    public String requestGenericWhatsAppOtp(@RequestBody AuthRequestDto authRequestDTO) {
        return authManager.requestGenericWhatsAppOtp(authRequestDTO);
    }

    /**
     * Verify WhatsApp OTP without user validation or JWT generation.
     * Returns success/failure status only.
     */
    @PostMapping("/verify-generic-whatsapp-otp")
    public ResponseEntity<Boolean> verifyGenericWhatsAppOtp(@RequestBody AuthRequestDto authRequestDTO) {
        boolean isValid = authManager.verifyGenericWhatsAppOtp(authRequestDTO);
        return ResponseEntity.ok(isValid);
    }
}
