package vacademy.io.auth_service.feature.auth.manager;


import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import vacademy.io.auth_service.feature.auth.constants.AuthConstants;
import vacademy.io.auth_service.feature.auth.dto.AuthRequestDto;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.auth.dto.RegisterRequest;
import vacademy.io.auth_service.feature.auth.service.AuthService;
import vacademy.io.common.auth.dto.RefreshTokenRequestDTO;
import vacademy.io.common.auth.entity.RefreshToken;
import vacademy.io.common.auth.entity.Role;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.repository.RoleRepository;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.auth.service.JwtService;
import vacademy.io.common.auth.service.RefreshTokenService;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.ExpiredTokenException;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.InstituteIdAndNameDTO;
import vacademy.io.common.institute.dto.InstituteInfoDTO;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static vacademy.io.auth_service.feature.auth.constants.AuthConstants.ADMIN_ROLE;

@Component
public class AuthManager {

    @Autowired
    UserRepository userRepository;

    @Autowired
    JwtService jwtService;

    @Autowired
    UserRoleRepository userRoleRepository;

    @Autowired
    RefreshTokenService refreshTokenService;

    @Autowired
    AuthenticationManager authenticationManager;

    @Autowired
    RestTemplate restTemplate;
    @Autowired
    AuthService authService;
    @Autowired
    InternalClientUtils internalClientUtils;

    @Autowired
    RoleRepository roleRepository;

    @Value("${admin.core.service.base_url}")
    private String adminCoreServiceBaseUrl;
    @Value("${spring.application.name}")
    private String applicationName;

    public JwtResponseDto registerRootUser(RegisterRequest registerRequest) {

        String userName = registerRequest.getUserName().trim().toLowerCase();

        InstituteInfoDTO instituteInfoDTO = registerRequest.getInstitute();
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(applicationName, HttpMethod.POST.name(), adminCoreServiceBaseUrl, AuthConstants.CREATE_INSTITUTES_PATH, instituteInfoDTO);

        ObjectMapper objectMapper = new ObjectMapper();
        InstituteIdAndNameDTO customUserDetails;

        try {
            customUserDetails = objectMapper.readValue(response.getBody(), new TypeReference<InstituteIdAndNameDTO>() {
            });

        } catch (JsonProcessingException e) {
            throw new VacademyException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to register user institutes due to service unavailability: " + e.getMessage());
        }


        UserRole userRole = new UserRole();
        userRole.setRole(getAdminRole());
        userRole.setInstituteId(customUserDetails.getInstituteId());

        User newUser = authService.createUser(registerRequest, Set.of(userRole));

        // Generate a refresh token
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(userName, "VACADEMY-WEB");


        return authService.generateJwtTokenForUser(newUser, refreshToken, List.of(userRole));
    }


    private Role getAdminRole() {
        return roleRepository.findByName(ADMIN_ROLE).orElseThrow(() -> new VacademyException(HttpStatus.INTERNAL_SERVER_ERROR, "Role 'ADMIN' not found"));
    }


    public JwtResponseDto loginUser(AuthRequestDto authRequestDTO) {

        Authentication authentication = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(authRequestDTO.getInstituteId() + "@" + authRequestDTO.getUserName(), authRequestDTO.getPassword()));
        if (authentication.isAuthenticated()) {

            String username = authRequestDTO.getUserName();

            Optional<User> userOptional = userRepository.findByUsername(username);
            if (userOptional.isEmpty() || !userOptional.get().isRootUser()) {
                throw new UsernameNotFoundException("invalid user request..!!");
            }

            refreshTokenService.deleteAllRefreshToken(userOptional.get());

            User user = userOptional.get();

            List<UserRole> userRoles = userRoleRepository.findByUser(user);


            RefreshToken refreshToken = refreshTokenService.createRefreshToken(authRequestDTO.getUserName(), authRequestDTO.getClientName());
            return JwtResponseDto.builder().accessToken(jwtService.generateToken(user, userRoles)).refreshToken(refreshToken.getToken()).build();

        } else {
            throw new UsernameNotFoundException("invalid user request..!!");
        }
    }

    public JwtResponseDto refreshToken(RefreshTokenRequestDTO refreshTokenRequestDTO) {
        return refreshTokenService.findByToken(refreshTokenRequestDTO.getToken()).map(refreshTokenService::verifyExpiration).map(RefreshToken::getUserInfo).map(userInfo -> {

            List<UserRole> userRoles = userRoleRepository.findByUser(userInfo);

            // Generate new access token
            String accessToken = jwtService.generateToken(userInfo, userRoles);
            // Return the new JWT token
            return JwtResponseDto.builder().accessToken(accessToken).build();
        }).orElseThrow(() -> new ExpiredTokenException(refreshTokenRequestDTO.getToken() + " Refresh token is. Please make a new login..!"));

    }
}
