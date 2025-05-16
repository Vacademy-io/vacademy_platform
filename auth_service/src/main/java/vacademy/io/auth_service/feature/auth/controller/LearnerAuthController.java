package vacademy.io.auth_service.feature.auth.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.auth_service.feature.auth.dto.AuthRequestDto;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.auth.manager.LearnerAuthManager;
import vacademy.io.common.auth.dto.RefreshTokenRequestDTO;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.service.JwtService;
import vacademy.io.common.auth.service.RefreshTokenService;


@RestController
@RequestMapping("/auth-service/learner/v1")
public class LearnerAuthController {


    @Autowired
    UserRepository userRepository;

    @Autowired
    JwtService jwtService;

    @Autowired
    RefreshTokenService refreshTokenService;

    @Autowired
    LearnerAuthManager authManager;

    @PostMapping("/login")
    public JwtResponseDto authenticateAndGetToken(@RequestBody AuthRequestDto authRequestDTO) {
        return authManager.loginUser(authRequestDTO);
    }

    @PostMapping("/request-otp")
    public String requestOtp(@RequestBody AuthRequestDto authRequestDTO) {
        return authManager.requestOtp(authRequestDTO);
    }

    @PostMapping("/login-otp")
    public JwtResponseDto loginViaOtp(@RequestBody AuthRequestDto authRequestDTO) {
        return authManager.loginViaOtp(authRequestDTO);
    }

    @PostMapping("/refresh-token")
    public JwtResponseDto refreshToken(@RequestBody RefreshTokenRequestDTO refreshTokenRequestDTO) {
        return authManager.refreshToken(refreshTokenRequestDTO);
    }

}




