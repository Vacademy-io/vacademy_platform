package vacademy.io.auth_service.feature.auth.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.auth.dto.RegisterRequest;
import vacademy.io.auth_service.feature.institute.InstituteInfoDTO;
import vacademy.io.auth_service.feature.institute.InstituteInternalService;
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
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
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
    @Autowired
    private InstituteInternalService instituteInternalService;

    @Transactional
    public User createUser(RegisterRequest registerRequest, Set<UserRole> roles) {
        boolean isAlreadyPresent = false;
        String normalizedEmail = registerRequest.getEmail() != null ? registerRequest.getEmail().toLowerCase() : null;
        Optional<User> optionalUser = userRepository.findFirstByEmailOrderByCreatedAtDesc(normalizedEmail);
        User user;

        if (optionalUser.isPresent()) {
            isAlreadyPresent = true;
            user = optionalUser.get();
        } else {
            user = User.builder()
                    .fullName(registerRequest.getFullName())
                    .username(registerRequest.getUserName())
                    .email(normalizedEmail)
                    .password(registerRequest.getPassword())
                    .isRootUser(true)
                    .build();
            user = userRepository.save(user); // Save first to get the ID
        }

        // Assign the user to each UserRole
        for (UserRole role : roles) {
            role.setUser(user);
        }

        user.setRoles(roles); // Now set the roles
        user = userRepository.save(user); // Save again with roles

        if (isAlreadyPresent) {
            sendKeepingCredentialsWelcomeMailToUser(user, registerRequest.getInstitute().getId());
        } else {
            sendWelcomeMailToUser(user, registerRequest.getInstitute().getId());
        }

        return user;
    }

    @Transactional
    public User createUser(UserDTO registerRequest, String instituteId, boolean sendWelcomeMail) {
        String normalizedEmail = registerRequest.getEmail() != null ? registerRequest.getEmail().toLowerCase() : null;
        Optional<User> optionalUser = userRepository.findFirstByEmailOrderByCreatedAtDesc(normalizedEmail);
        boolean isAlreadyPresent = optionalUser.isPresent();

        User user;

        if (isAlreadyPresent) {
            user = optionalUser.get();

            if (StringUtils.hasText(registerRequest.getFullName())) user.setFullName(registerRequest.getFullName());
            if (StringUtils.hasText(registerRequest.getUsername())) user.setUsername(registerRequest.getUsername());
            if (StringUtils.hasText(registerRequest.getPassword())) user.setPassword(registerRequest.getPassword());
            if (StringUtils.hasText(registerRequest.getAddressLine())) user.setAddressLine(registerRequest.getAddressLine());
            if (StringUtils.hasText(registerRequest.getCity())) user.setCity(registerRequest.getCity());
            if (StringUtils.hasText(registerRequest.getPinCode())) user.setPinCode(registerRequest.getPinCode());
            if (StringUtils.hasText(registerRequest.getMobileNumber())) user.setMobileNumber(registerRequest.getMobileNumber());
            if (registerRequest.getDateOfBirth() != null) user.setDateOfBirth(registerRequest.getDateOfBirth());
            if (StringUtils.hasText(registerRequest.getGender())) user.setGender(registerRequest.getGender());
            if (StringUtils.hasText(registerRequest.getProfilePicFileId())) user.setProfilePicFileId(registerRequest.getProfilePicFileId());

            if (!user.isRootUser()) user.setRootUser(true);

            user = userRepository.save(user);
        } else {
            if (!StringUtils.hasText(registerRequest.getUsername())) {
                registerRequest.setUsername(UsernameGenerator.generateUsername(registerRequest.getFullName()));
            }
            if (!StringUtils.hasText(registerRequest.getPassword())) {
                registerRequest.setPassword(UsernameGenerator.generatePassword(8));
            }
            user = User.builder()
                    .fullName(registerRequest.getFullName())
                    .username(registerRequest.getUsername())
                    .email(normalizedEmail)
                    .password(registerRequest.getPassword())
                    .addressLine(registerRequest.getAddressLine())
                    .city(registerRequest.getCity())
                    .pinCode(registerRequest.getPinCode())
                    .mobileNumber(registerRequest.getMobileNumber())
                    .dateOfBirth(registerRequest.getDateOfBirth())
                    .gender(registerRequest.getGender())
                    .profilePicFileId(registerRequest.getProfilePicFileId())
                    .isRootUser(true)
                    .build();

            user = userRepository.save(user);
        }

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
        user.setRoles(userRoleSet);
        user = userRepository.save(user);

        if (sendWelcomeMail) {
            if (isAlreadyPresent) {
                sendKeepingCredentialsWelcomeMailToUser(user, instituteId);
            } else {
                sendWelcomeMailToUser(user, instituteId);
            }
        }

        return user;
    }


    private List<Role> getAllUserRoles(List<String> userRoles) {
        return roleRepository.findByNameIn(userRoles);
    }

    public JwtResponseDto generateJwtTokenForUser(User user, RefreshToken refreshToken, List<UserRole> userRoles) {

        List<String> userPermissions = userPermissionRepository.findByUserId(user.getId()).stream()
                .map(UserPermission::getPermissionId).toList();
        String accessToken = jwtService.generateToken(user, userRoles, userPermissions);

        // Return a JwtResponseDto with access token and refresh token
        return JwtResponseDto.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken.getToken())
                .build();
    }

    public void sendWelcomeMailToUser(User user, String instituteId) {
        InstituteInfoDTO instituteInfoDTO = null;

        String instituteName = "Vacademy"; // Default fallback
        String theme = "#E67E22";
        String learnerLoginUrl = "https://dash.vacademy.io";
        if (StringUtils.hasText(instituteId)) {
            instituteInfoDTO = instituteInternalService.getInstituteByInstituteId(instituteId);
            if (instituteInfoDTO.getInstituteName() != null)
                instituteName = instituteInfoDTO.getInstituteName();
            if (instituteInfoDTO.getInstituteThemeCode() != null)
                theme = instituteInfoDTO.getInstituteThemeCode();
            if (instituteInfoDTO.getLearnerPortalUrl() != null)
                learnerLoginUrl = instituteInfoDTO.getLearnerPortalUrl();
        }
        GenericEmailRequest genericEmailRequest = new GenericEmailRequest();
        genericEmailRequest.setTo(user.getEmail());
        genericEmailRequest.setBody(NotificationEmailBody.createWelcomeEmailBody(instituteName, user.getFullName(),
                user.getUsername(), user.getPassword(), learnerLoginUrl, theme));
        genericEmailRequest.setSubject("Welcome to " + instituteName);
        notificationService.sendGenericHtmlMail(genericEmailRequest, instituteId);
    }

    public void sendKeepingCredentialsWelcomeMailToUser(User user, String instituteId) {
        if (user == null || user.getEmail() == null) {
            throw new IllegalArgumentException("User or user email must not be null");
        }
        InstituteInfoDTO instituteInfoDTO = null;

        String instituteName = "Vacademy"; // Default fallback
        String theme = "#E67E22";
        String learnerLoginUrl = "https://dash.vacademy.io";
        if (StringUtils.hasText(instituteId)) {
            instituteInfoDTO = instituteInternalService.getInstituteByInstituteId(instituteId);
            if (instituteInfoDTO.getInstituteName() != null)
                instituteName = instituteInfoDTO.getInstituteName();
            if (instituteInfoDTO.getInstituteThemeCode() != null)
                theme = instituteInfoDTO.getInstituteThemeCode();
            if (instituteInfoDTO.getLearnerPortalUrl() != null)
                learnerLoginUrl = instituteInfoDTO.getLearnerPortalUrl();
        }

        String fullName = user.getFullName() != null ? user.getFullName() : "User";
        String username = user.getUsername() != null ? user.getUsername() : "N/A";
        String password = user.getPassword() != null ? user.getPassword() : "N/A"; // You might want to avoid sending
        // passwords in email

        String body = NotificationEmailBody.createCredentialsFoundEmailBody(
                instituteName,
                fullName,
                username,
                password,
                learnerLoginUrl,
                theme);

        GenericEmailRequest emailRequest = new GenericEmailRequest();
        emailRequest.setTo(user.getEmail());
        emailRequest.setSubject("Welcome to " + instituteName);
        emailRequest.setBody(body);

        notificationService.sendGenericHtmlMail(emailRequest, instituteId);
    }

}
