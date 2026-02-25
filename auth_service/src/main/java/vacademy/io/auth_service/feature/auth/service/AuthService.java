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
    @Autowired
    private InstituteSettingsService instituteSettingsService;
    @Value("${default.learner.portal.url}")
    private String defaultLearnerPortalUrl;

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
            sendKeepingCredentialsWelcomeMailToUser(user, registerRequest.getInstitute().getId(), roles);
        } else {
            sendWelcomeMailToUser(user, registerRequest.getInstitute().getId(), roles);
        }
        return user;
    }

    @Transactional
    public User createUser(UserDTO registerRequest, String instituteId, boolean sendWelcomeMail) {
        String normalizedEmail = registerRequest.getEmail() != null ? registerRequest.getEmail().toLowerCase() : null;
        Optional<User> optionalUser = Optional.empty();

        if (StringUtils.hasText(registerRequest.getMobileNumber())) {
            registerRequest.setMobileNumber(registerRequest.getMobileNumber().replaceAll("[^0-9]", ""));
        }

        String userIdentifier = instituteSettingsService.getUserIdentifier(instituteId);

        if ("PHONE".equalsIgnoreCase(userIdentifier) && StringUtils.hasText(registerRequest.getMobileNumber())) {
            if (!registerRequest.getMobileNumber().isEmpty()) {
                optionalUser = userRepository.findLatestUserByMobileNumber(registerRequest.getMobileNumber());
            }
        }

        if (optionalUser.isEmpty() && StringUtils.hasText(normalizedEmail)) {
            optionalUser = userRepository.findFirstByEmailOrderByCreatedAtDesc(normalizedEmail);
        }

        if (optionalUser.isEmpty() && StringUtils.hasText(registerRequest.getUsername())) {
            optionalUser = userRepository.findByUsername(registerRequest.getUsername());
        }

        boolean isAlreadyPresent = optionalUser.isPresent();
        User user;
        if (isAlreadyPresent) {
            user = optionalUser.get();
            // Update email if the existing user doesn't have one but the request provides
            // one
            if (StringUtils.hasText(normalizedEmail) && !StringUtils.hasText(user.getEmail()))
                user.setEmail(normalizedEmail);
            if (StringUtils.hasText(registerRequest.getFullName()))
                user.setFullName(registerRequest.getFullName());
            if (StringUtils.hasText(registerRequest.getAddressLine()))
                user.setAddressLine(registerRequest.getAddressLine());
            if (StringUtils.hasText(registerRequest.getCity()))
                user.setCity(registerRequest.getCity());
            if (StringUtils.hasText(registerRequest.getPinCode()))
                user.setPinCode(registerRequest.getPinCode());
            if (StringUtils.hasText(registerRequest.getMobileNumber()))
                user.setMobileNumber(registerRequest.getMobileNumber());
            if (registerRequest.getDateOfBirth() != null)
                user.setDateOfBirth(registerRequest.getDateOfBirth());
            if (StringUtils.hasText(registerRequest.getGender()))
                user.setGender(registerRequest.getGender());
            if (StringUtils.hasText(registerRequest.getProfilePicFileId()))
                user.setProfilePicFileId(registerRequest.getProfilePicFileId());
            if (StringUtils.hasText(registerRequest.getLinkedParentId()))
                user.setLinkedParentId(registerRequest.getLinkedParentId());
            if (!user.isRootUser())
                user.setRootUser(true);
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
                    .linkedParentId(registerRequest.getLinkedParentId())
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
                sendKeepingCredentialsWelcomeMailToUser(user, instituteId, userRoleSet);
            } else {
                sendWelcomeMailToUser(user, instituteId, userRoleSet);
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

    public void sendWelcomeMailToUser(User user, String instituteId, Set<UserRole> roles) {
        InstituteInfoDTO instituteInfoDTO = null;
        boolean isLearner = false;
        if (roles != null) {
            for (UserRole userRole : roles) {
                if (userRole.getRole().getName().equals("STUDENT")) {
                    isLearner = true;
                    break;
                }
            }
        }
        String instituteName = "Vacademy"; // Default fallback
        String theme = "#E67E22";
        String loginUrl = "https://dash.vacademy.io";
        if (StringUtils.hasText(instituteId)) {
            instituteInfoDTO = instituteInternalService.getInstituteByInstituteId(instituteId);
            if (instituteInfoDTO.getInstituteName() != null)
                instituteName = instituteInfoDTO.getInstituteName();
            if (instituteInfoDTO.getInstituteThemeCode() != null)
                theme = instituteInfoDTO.getInstituteThemeCode();
            if (isLearner) {
                if (instituteInfoDTO.getLearnerPortalUrl() != null)
                    loginUrl = instituteInfoDTO.getLearnerPortalUrl();
                else
                    loginUrl = defaultLearnerPortalUrl;
            }
        }
        GenericEmailRequest genericEmailRequest = new GenericEmailRequest();
        genericEmailRequest.setTo(user.getEmail());
        genericEmailRequest.setBody(NotificationEmailBody.createWelcomeEmailBody(instituteName, user.getFullName(),
                user.getUsername(), user.getPassword(), loginUrl, theme));
        genericEmailRequest.setSubject("Welcome to " + instituteName);
        notificationService.sendGenericHtmlMail(genericEmailRequest, instituteId);
    }

    public void sendKeepingCredentialsWelcomeMailToUser(User user, String instituteId, Set<UserRole> roles) {
        if (user == null || user.getEmail() == null) {
            throw new IllegalArgumentException("User or user email must not be null");
        }
        InstituteInfoDTO instituteInfoDTO = null;
        boolean isLearner = false;
        if (roles != null) {
            for (UserRole userRole : roles) {
                if (userRole.getRole().getName().equals("STUDENT")) {
                    isLearner = true;
                    break;
                }
            }
        }
        String instituteName = "Vacademy"; // Default fallback
        String theme = "#E67E22";
        String loginUrl = "https://dash.vacademy.io";
        if (StringUtils.hasText(instituteId)) {
            instituteInfoDTO = instituteInternalService.getInstituteByInstituteId(instituteId);
            if (instituteInfoDTO.getInstituteName() != null)
                instituteName = instituteInfoDTO.getInstituteName();
            if (instituteInfoDTO.getInstituteThemeCode() != null)
                theme = instituteInfoDTO.getInstituteThemeCode();
            if (isLearner) {
                if (instituteInfoDTO.getLearnerPortalUrl() != null)
                    loginUrl = instituteInfoDTO.getLearnerPortalUrl();
                else
                    loginUrl = defaultLearnerPortalUrl;
            }
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
                loginUrl,
                theme);
        GenericEmailRequest emailRequest = new GenericEmailRequest();
        emailRequest.setTo(user.getEmail());
        emailRequest.setSubject("Welcome to " + instituteName);
        emailRequest.setBody(body);
        notificationService.sendGenericHtmlMail(emailRequest, instituteId);
    }

    @Transactional
    public List<UserDTO> createMultipleUsers(List<UserDTO> userDTOs, String instituteId, boolean isNotify) {
        if (userDTOs == null || userDTOs.isEmpty()) {
            throw new IllegalArgumentException("User DTOs list cannot be null or empty");
        }

        if (userDTOs.size() != 2) {
            throw new IllegalArgumentException("Expected exactly 2 users (parent and child)");
        }

        UserDTO parentDTO = userDTOs.get(0);
        UserDTO childDTO = userDTOs.get(1);

        User parentUser = createUser(parentDTO, instituteId, isNotify);
        parentUser.setIsParent(true);
        parentUser = userRepository.save(parentUser);

        User childUser = createUser(childDTO, instituteId, isNotify);
        childUser.setLinkedParentId(parentUser.getId());
        childUser = userRepository.save(childUser);

        UserDTO parentResponseDTO = convertToUserDto(parentUser);
        UserDTO childResponseDTO = convertToUserDto(childUser);

        return List.of(parentResponseDTO, childResponseDTO);
    }

    private UserDTO convertToUserDto(User user) {
        UserDTO childResponseDTO = new UserDTO();
        childResponseDTO.setId(user.getId());
        childResponseDTO.setFullName(user.getFullName());
        childResponseDTO.setEmail(user.getEmail());
        childResponseDTO.setUsername(user.getUsername());
        childResponseDTO.setMobileNumber(user.getMobileNumber());
        childResponseDTO.setAddressLine(user.getAddressLine());
        childResponseDTO.setCity(user.getCity());
        childResponseDTO.setPinCode(user.getPinCode());
        childResponseDTO.setGender(user.getGender());
        childResponseDTO.setDateOfBirth(user.getDateOfBirth());
        childResponseDTO.setProfilePicFileId(user.getProfilePicFileId());
        childResponseDTO.setIsParent(user.getIsParent());
        childResponseDTO.setLinkedParentId(user.getLinkedParentId());
        return childResponseDTO;

    }

    /**
     * Finds the latest user by mobile number, handling various formats.
     * Supports: +917999742868, 7999742868, 917999742868, or any country code.
     * 
     * @param mobileNumber the phone number in any format
     * @return Optional containing UserDTO if found, empty otherwise
     */
    public Optional<UserDTO> getUserByMobileNumber(String mobileNumber) {
        if (mobileNumber == null || mobileNumber.trim().isEmpty()) {
            return Optional.empty();
        }

        // Remove all non-digit characters
        String digitsOnly = mobileNumber.replaceAll("[^0-9]", "");

        if (digitsOnly.isEmpty()) {
            return Optional.empty();
        }

        Optional<User> userOpt = userRepository.findLatestUserByMobileNumber(digitsOnly);
        return userOpt.map(this::convertToUserDto);
    }

    /**
     * Creates a user for learner enrollment with specialized email templates.
     * Uses different templates than the regular createUser method.
     */
    @Transactional
    public User createUserForLearnerEnrollment(UserDTO registerRequest, String instituteId, boolean sendWelcomeMail) {
        String normalizedEmail = registerRequest.getEmail() != null ? registerRequest.getEmail().toLowerCase() : null;
        Optional<User> optionalUser = Optional.empty();

        if (StringUtils.hasText(registerRequest.getMobileNumber())) {
            registerRequest.setMobileNumber(registerRequest.getMobileNumber().replaceAll("[^0-9]", ""));
        }

        String userIdentifier = instituteSettingsService.getUserIdentifier(instituteId);

        if ("PHONE".equalsIgnoreCase(userIdentifier) && StringUtils.hasText(registerRequest.getMobileNumber())) {
            if (!registerRequest.getMobileNumber().isEmpty()) {
                optionalUser = userRepository.findLatestUserByMobileNumber(registerRequest.getMobileNumber());
            }
        }

        if (optionalUser.isEmpty() && StringUtils.hasText(normalizedEmail)) {
            optionalUser = userRepository.findFirstByEmailOrderByCreatedAtDesc(normalizedEmail);
        }

        if (optionalUser.isEmpty() && StringUtils.hasText(registerRequest.getUsername())) {
            optionalUser = userRepository.findByUsername(registerRequest.getUsername());
        }

        boolean isAlreadyPresent = optionalUser.isPresent();
        User user;
        if (isAlreadyPresent) {
            user = optionalUser.get();
            // Update email if the existing user doesn't have one but the request provides
            // one
            if (StringUtils.hasText(normalizedEmail) && !StringUtils.hasText(user.getEmail()))
                user.setEmail(normalizedEmail);
            if (StringUtils.hasText(registerRequest.getFullName()))
                user.setFullName(registerRequest.getFullName());
            if (StringUtils.hasText(registerRequest.getAddressLine()))
                user.setAddressLine(registerRequest.getAddressLine());
            if (StringUtils.hasText(registerRequest.getCity()))
                user.setCity(registerRequest.getCity());
            if (StringUtils.hasText(registerRequest.getPinCode()))
                user.setPinCode(registerRequest.getPinCode());
            if (StringUtils.hasText(registerRequest.getMobileNumber()))
                user.setMobileNumber(registerRequest.getMobileNumber());
            if (registerRequest.getDateOfBirth() != null)
                user.setDateOfBirth(registerRequest.getDateOfBirth());
            if (StringUtils.hasText(registerRequest.getGender()))
                user.setGender(registerRequest.getGender());
            if (StringUtils.hasText(registerRequest.getProfilePicFileId()))
                user.setProfilePicFileId(registerRequest.getProfilePicFileId());
            if (StringUtils.hasText(registerRequest.getLinkedParentId()))
                user.setLinkedParentId(registerRequest.getLinkedParentId());
            if (!user.isRootUser())
                user.setRootUser(true);
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
                    .linkedParentId(registerRequest.getLinkedParentId())
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
                sendLearnerEnrollmentExistingUserEmail(user, instituteId, userRoleSet);
            } else {
                sendLearnerEnrollmentNewUserEmail(user, instituteId, userRoleSet);
            }
        }
        return user;
    }

    /**
     * Sends enrollment email to a NEW learner.
     */
    public void sendLearnerEnrollmentNewUserEmail(User user, String instituteId, Set<UserRole> roles) {
        InstituteInfoDTO instituteInfoDTO = null;
        boolean isLearner = false;
        if (roles != null) {
            for (UserRole userRole : roles) {
                if (userRole.getRole().getName().equals("STUDENT")) {
                    isLearner = true;
                    break;
                }
            }
        }
        String instituteName = "Vacademy";
        String theme = "#E67E22";
        String loginUrl = "https://dash.vacademy.io";
        if (StringUtils.hasText(instituteId)) {
            instituteInfoDTO = instituteInternalService.getInstituteByInstituteId(instituteId);
            if (instituteInfoDTO.getInstituteName() != null)
                instituteName = instituteInfoDTO.getInstituteName();
            if (instituteInfoDTO.getInstituteThemeCode() != null)
                theme = instituteInfoDTO.getInstituteThemeCode();
            if (isLearner) {
                if (instituteInfoDTO.getLearnerPortalUrl() != null)
                    loginUrl = instituteInfoDTO.getLearnerPortalUrl();
                else
                    loginUrl = defaultLearnerPortalUrl;
            }
        }
        GenericEmailRequest genericEmailRequest = new GenericEmailRequest();
        genericEmailRequest.setTo(user.getEmail());
        genericEmailRequest.setBody(NotificationEmailBody.createLearnerEnrollmentNewUserEmailBody(
                instituteName, user.getFullName(),
                user.getUsername(), user.getPassword(), loginUrl, theme));
        genericEmailRequest.setSubject("Course Enrollment - " + instituteName);
        notificationService.sendGenericHtmlMail(genericEmailRequest, instituteId);
    }

    /**
     * Sends enrollment email to an EXISTING learner with retained credentials.
     */
    public void sendLearnerEnrollmentExistingUserEmail(User user, String instituteId, Set<UserRole> roles) {
        if (user == null || user.getEmail() == null) {
            throw new IllegalArgumentException("User or user email must not be null");
        }
        InstituteInfoDTO instituteInfoDTO = null;
        boolean isLearner = false;
        if (roles != null) {
            for (UserRole userRole : roles) {
                if (userRole.getRole().getName().equals("STUDENT")) {
                    isLearner = true;
                    break;
                }
            }
        }
        String instituteName = "Vacademy";
        String theme = "#E67E22";
        String loginUrl = "https://dash.vacademy.io";
        if (StringUtils.hasText(instituteId)) {
            instituteInfoDTO = instituteInternalService.getInstituteByInstituteId(instituteId);
            if (instituteInfoDTO.getInstituteName() != null)
                instituteName = instituteInfoDTO.getInstituteName();
            if (instituteInfoDTO.getInstituteThemeCode() != null)
                theme = instituteInfoDTO.getInstituteThemeCode();
            if (isLearner) {
                if (instituteInfoDTO.getLearnerPortalUrl() != null)
                    loginUrl = instituteInfoDTO.getLearnerPortalUrl();
                else
                    loginUrl = defaultLearnerPortalUrl;
            }
        }
        String fullName = user.getFullName() != null ? user.getFullName() : "User";
        String username = user.getUsername() != null ? user.getUsername() : "N/A";
        String password = user.getPassword() != null ? user.getPassword() : "N/A";
        String body = NotificationEmailBody.createLearnerEnrollmentExistingUserEmailBody(
                instituteName,
                fullName,
                username,
                password,
                loginUrl,
                theme);
        GenericEmailRequest emailRequest = new GenericEmailRequest();
        emailRequest.setTo(user.getEmail());
        emailRequest.setSubject("Course Enrollment - " + instituteName);
        emailRequest.setBody(body);
        notificationService.sendGenericHtmlMail(emailRequest, instituteId);
    }
}