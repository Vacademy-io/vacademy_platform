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
import vacademy.io.auth_service.feature.notification.service.NotificationEmailBody;
import vacademy.io.auth_service.feature.notification.service.NotificationService;
import vacademy.io.common.auth.dto.RefreshTokenRequestDTO;
import vacademy.io.common.auth.entity.RefreshToken;
import vacademy.io.common.auth.entity.Role;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.enums.UserRoleStatus;
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
import vacademy.io.common.notification.dto.GenericEmailRequest;

import java.util.*;
import java.util.stream.Collectors;

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

    @Autowired
    private NotificationService notificationService;

    public JwtResponseDto registerRootUser(RegisterRequest registerRequest) {
        if(Objects.isNull(registerRequest)) throw new VacademyException("Invalid Request");

        String userName = registerRequest.getUserName().trim().toLowerCase();
        Optional<User> userOptional = userRepository.findByUsername(userName);

        if(userOptional.isPresent()) throw new VacademyException("User Already Exist");

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


        List<Role> allRoles = getAllUserRoles(registerRequest.getUserRoles());
        Set<UserRole> userRoleSet = new HashSet<>();

        allRoles.forEach(role->{
            UserRole userRole = new UserRole();
            userRole.setRole(role);
            userRole.setInstituteId(customUserDetails.getInstituteId());

            userRoleSet.add(userRole);
        });

        User newUser = authService.createUser(registerRequest, userRoleSet);

        // Generate a refresh token
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(userName, "VACADEMY-WEB");

        sendWelcomeMailToUser(newUser);

        return authService.generateJwtTokenForUser(newUser, refreshToken, userRoleSet.stream().toList());
    }


    private Role getAdminRole() {
        return roleRepository.findByName(ADMIN_ROLE).orElseThrow(() -> new VacademyException(HttpStatus.INTERNAL_SERVER_ERROR, "Role 'ADMIN' not found"));
    }

    private List<Role> getAllUserRoles(List<String> userRoles) {
        return roleRepository.findByNameIn(userRoles);
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

            if (!userRoles.isEmpty()) {
                userRoleRepository.updateUserRoleStatusByInstituteIdAndUserId(UserRoleStatus.ACTIVE.name(),userRoles.get(0).getInstituteId(),List.of(user.getId()));
            }

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

    public void sendWelcomeMailToUser(User user){
        GenericEmailRequest genericEmailRequest = new GenericEmailRequest();
        genericEmailRequest.setTo(user.getEmail());
        genericEmailRequest.setBody(NotificationEmailBody.createWelcomeEmailBody("Vacademy",user.getFullName(), user.getUsername(), user.getPassword()));
        genericEmailRequest.setSubject("Welcome to Vacademy");
        notificationService.sendGenericHtmlMail(genericEmailRequest);
    }
}
