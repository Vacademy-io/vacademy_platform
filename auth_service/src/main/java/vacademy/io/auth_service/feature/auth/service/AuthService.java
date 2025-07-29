package vacademy.io.auth_service.feature.auth.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;
import vacademy.io.auth_service.feature.auth.constants.AuthConstants;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.auth.dto.RegisterRequest;
import vacademy.io.auth_service.feature.notification.service.NotificationEmailBody;
import vacademy.io.auth_service.feature.notification.service.NotificationService;
import vacademy.io.auth_service.feature.user.repository.PermissionRepository;
import vacademy.io.auth_service.feature.util.UsernameGenerator;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.entity.*;
import vacademy.io.common.auth.enums.UserRoleStatus;
import vacademy.io.common.auth.repository.RoleRepository;
import vacademy.io.common.auth.repository.UserPermissionRepository;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.auth.service.JwtService;
import vacademy.io.common.auth.service.RefreshTokenService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.notification.dto.GenericEmailRequest;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
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
    @Autowired
    private NotificationService notificationService;
    @Autowired
    private UserPermissionRepository userPermissionRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Transactional
    public User createUser(RegisterRequest registerRequest, Set<UserRole> roles) {
        boolean isAlreadyPresent = false;
        Optional<User> optionalUser = userRepository.findFirstByEmailOrderByCreatedAtDesc(registerRequest.getEmail());
        User user = null;
        if (optionalUser.isPresent()){
            isAlreadyPresent = true;
            user = optionalUser.get();
            user.setRoles(roles);
        }else{
            user = User.builder()
                    .fullName(registerRequest.getFullName())
                    .username(registerRequest.getUserName())
                    .email(registerRequest.getEmail())
                    .password(registerRequest.getPassword())
                    .roles(roles)
                    .isRootUser(true)
                    .build();
            user = userRepository.save(user);
        }
        for (UserRole role : roles) {
            role.setUser(user);
        }

        userRepository.save(user);
        if(isAlreadyPresent){
            sendKeepingCredentialsWelcomeMailToUser(user);
        }else{
            sendWelcomeMailToUser(user);
        }
        return user;
    }

    @Transactional
    public User createUser(UserDTO registerRequest, String instituteId) {
        Optional<User> optionalUser = userRepository.findFirstByEmailOrderByCreatedAtDesc(registerRequest.getEmail());
        boolean isAlreadyPresent = optionalUser.isPresent();

        User user;

        if (isAlreadyPresent) {
            user = optionalUser.get();
        } else {
            if(!StringUtils.hasText(registerRequest.getUsername())){
                registerRequest.setUsername(UsernameGenerator.generateUsername(registerRequest.getFullName()));
            }
            if(!StringUtils.hasText(registerRequest.getPassword())) {
                registerRequest.setPassword(UsernameGenerator.generatePassword(8));
            }
            user = User.builder()
                    .fullName(registerRequest.getFullName())
                    .username(registerRequest.getUsername())
                    .email(registerRequest.getEmail())
                    .password(registerRequest.getPassword())
                    .isRootUser(true)
                    .build();
            user = userRepository.save(user);
        }

        // Build user roles
        List<Role> allRoles = getAllUserRoles(registerRequest.getRoles());
        Set<UserRole> userRoleSet = new HashSet<>();

        for (Role role : allRoles) {
            UserRole userRole = new UserRole();
            userRole.setRole(role);
            userRole.setStatus(UserRoleStatus.ACTIVE.name());
            userRole.setInstituteId(instituteId);
            userRole.setUser(user);
            userRoleSet.add(userRole);
        }

        // Set roles and save again
        user.setRoles(userRoleSet);
        user = userRepository.save(user);

        // Send appropriate welcome mail
        if (isAlreadyPresent) {
            sendKeepingCredentialsWelcomeMailToUser(user);
        } else {
            sendWelcomeMailToUser(user);
        }

        return user;
    }


    private List<Role> getAllUserRoles(List<String> userRoles) {
        return roleRepository.findByNameIn(userRoles);
    }

    public JwtResponseDto generateJwtTokenForUser(User user, RefreshToken refreshToken, List<UserRole> userRoles) {

        List<String>userPermissions = userPermissionRepository.findByUserId(user.getId()).stream().map(UserPermission::getPermissionId).toList();
        String accessToken = jwtService.generateToken(user, userRoles,userPermissions);

        // Return a JwtResponseDto with access token and refresh token
        return JwtResponseDto.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken.getToken())
                .build();
    }

    public void sendWelcomeMailToUser(User user) {
        GenericEmailRequest genericEmailRequest = new GenericEmailRequest();
        genericEmailRequest.setTo(user.getEmail());
        genericEmailRequest.setBody(NotificationEmailBody.createWelcomeEmailBody("Vacademy", user.getFullName(), user.getUsername(), user.getPassword()));
        genericEmailRequest.setSubject("Welcome to Vacademy");
        notificationService.sendGenericHtmlMail(genericEmailRequest);
    }

    public void sendKeepingCredentialsWelcomeMailToUser(User user) {
        if (user == null || user.getEmail() == null) {
            throw new IllegalArgumentException("User or user email must not be null");
        }

        String fullName = user.getFullName() != null ? user.getFullName() : "User";
        String username = user.getUsername() != null ? user.getUsername() : "N/A";
        String password = user.getPassword() != null ? user.getPassword() : "N/A"; // You might want to avoid sending passwords in email

        String body = NotificationEmailBody.createCredentialsFoundEmailBody(
                "Vacademy",
                fullName,
                username,
                password
        );

        GenericEmailRequest emailRequest = new GenericEmailRequest();
        emailRequest.setTo(user.getEmail());
        emailRequest.setSubject("Welcome to Vacademy");
        emailRequest.setBody(body);

        notificationService.sendGenericHtmlMail(emailRequest);
    }


}
