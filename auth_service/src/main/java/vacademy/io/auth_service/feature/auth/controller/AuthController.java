package vacademy.io.auth_service.feature.auth.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.auth.dto.AuthRequestDto;
import vacademy.io.auth_service.feature.auth.dto.InstituteInfo;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.auth.dto.RegisterRequest;
import vacademy.io.auth_service.feature.auth.service.AuthService;
import vacademy.io.common.auth.dto.JwtResponseDTO;
import vacademy.io.common.auth.entity.RefreshToken;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.service.JwtService;
import vacademy.io.common.auth.service.RefreshTokenService;
import vacademy.io.common.exceptions.LaborLinkException;
import vacademy.io.common.notification.service.HtmlEmailService;


import java.util.*;



@RestController
@RequestMapping("auth/v1")
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
    AuthService authService;


    @Autowired
    HtmlEmailService htmlEmailService;


    @PostMapping("/signup-root")
    public JwtResponseDto registerUser(@RequestBody RegisterRequest registerRequest) {

        return authService.registerUser(registerRequest);

    }

    @PostMapping("/login-root")
    public JwtResponseDto authenticateAndGetToken(@RequestBody AuthRequestDto authRequestDTO) {

        return authService.loginUser(authRequestDTO);


    }










}




