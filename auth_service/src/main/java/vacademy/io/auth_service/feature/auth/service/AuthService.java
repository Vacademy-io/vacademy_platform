package vacademy.io.auth_service.feature.auth.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.auth.dto.RegisterRequest;
import vacademy.io.auth_service.feature.user.repository.PermissionRepository;
import vacademy.io.common.auth.entity.RefreshToken;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.repository.RoleRepository;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.service.JwtService;
import vacademy.io.common.auth.service.RefreshTokenService;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Set;

@Service
public class AuthService {

    @Autowired
    UserRepository userRepository;
    @Autowired
    AuthenticationManager authenticationManager;
    @Autowired
    JwtService jwtService;
    @Autowired
    RefreshTokenService refreshTokenService;
    @Autowired
    RestTemplate restTemplate;
    @Autowired
    RoleRepository roleRepository;
    @Autowired
    PermissionRepository permissionRepository;
    @Value("${admin.core.service.base_url}")
    private String adminCoreServiceBaseUrl;

    @Transactional
    public User createUser(RegisterRequest registerRequest, Set<UserRole> roles) {

        User user = User.builder()
                .fullName(registerRequest.getFullName())
                .username(registerRequest.getUserName())
                .email(registerRequest.getEmail())
                .password(registerRequest.getPassword())
                .roles(roles)
                .isRootUser(true)
                .build();

        for (UserRole role : roles) {
            role.setUser(user);
        }

        userRepository.save(user);

        return user;
    }

    public JwtResponseDto generateJwtTokenForUser(User user, RefreshToken refreshToken, List<UserRole> userRoles) {

        // Check if the user is a root user
        if (user.isRootUser()) {
            String accessToken = jwtService.generateToken(user, userRoles);

            // Return a JwtResponseDto with access token and refresh token
            return JwtResponseDto.builder()
                    .accessToken(accessToken)
                    .refreshToken(refreshToken.getToken())
                    .build();
        }

        // If the user is not a root user, you can handle other logic or throw an exception
        throw new VacademyException(HttpStatus.BAD_REQUEST, "Non-root user is not allowed to generate token.");
    }


}
