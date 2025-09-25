package vacademy.io.auth_service.feature.auth.manager;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.auth_service.feature.admin_core_service.dto.InstituteSignupPolicy;
import vacademy.io.auth_service.feature.admin_core_service.service.InstitutePolicyService;
import vacademy.io.auth_service.feature.auth.constants.AuthConstants;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.auth.service.AuthService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.entity.RefreshToken;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserPermission;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.enums.UserRoleStatus;
import vacademy.io.common.auth.repository.UserPermissionRepository;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.auth.service.JwtService;
import vacademy.io.common.auth.service.RefreshTokenService;

import java.util.List;
import java.util.Optional;

@Component
public class LearnerOAuth2Manager {

    private static final Logger log = LoggerFactory.getLogger(LearnerOAuth2Manager.class);

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private UserPermissionRepository userPermissionRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private InstitutePolicyService institutePolicyService;

    public JwtResponseDto loginUserByEmail(String fullName, String email, String instituteId) throws Exception {
        log.info("Attempting OAuth2 login for email={} fullName={} instituteId={}", email, fullName, instituteId);

        Optional<User> userOptional = userRepository.findMostRecentUserByEmailAndRoleStatusAndRoleNames(
                email,
                List.of(UserRoleStatus.ACTIVE.name(), UserRoleStatus.INVITED.name()),
                AuthConstants.VALID_ROLES_FOR_STUDENT_PORTAL
        );
        log.debug("User lookup result for email {}: {}", email, userOptional);

        if (userOptional.isPresent()) {
            User user = userOptional.get();
            log.info("User found: id={} username={} email={}", user.getId(), user.getUsername(), user.getEmail());

            log.debug("Deleting all existing refresh tokens for user {}", user.getUsername());
            refreshTokenService.deleteAllRefreshToken(user);

            List<UserRole> userRoles = userRoleRepository.findByUserAndStatusAndRoleName(
                    user,
                    UserRoleStatus.ACTIVE.name(),
                    "STUDENT"
            );
            log.debug("Fetched roles for user {}: {}", user.getUsername(), userRoles);

            if (userRoles.isEmpty()) {
                log.warn("User {} exists but has no STUDENT role. Checking signup policy for institute {}", user.getUsername(), instituteId);
                InstituteSignupPolicy signupPolicy = institutePolicyService.fetchSignupPolicy(instituteId);
                log.debug("Signup policy fetched for institute {}: {}", instituteId, signupPolicy);

                if (signupPolicy != null) {
                    if ("manual".equalsIgnoreCase(signupPolicy.getPasswordStrategy())) {
                        log.warn("Signup policy requires manual password strategy. Cannot auto-create STUDENT role.");
                        return null;
                    }
                    log.info("Creating user with STUDENT role as per signup policy...");
                    createUserFromPolicy(signupPolicy, fullName, email, instituteId);
                    return loginUserByEmail(fullName, email, instituteId);
                }
            }

            log.info("Generating new access & refresh tokens for user {}", user.getUsername());
            RefreshToken refreshToken = refreshTokenService.createRefreshToken(user.getUsername(), "oauth2-client");
            List<String> userPermissions = userPermissionRepository.findByUserId(user.getId())
                    .stream()
                    .map(UserPermission::getPermissionId)
                    .toList();
            log.debug("User permissions for {}: {}", user.getUsername(), userPermissions);

            JwtResponseDto response = JwtResponseDto.builder()
                    .accessToken(jwtService.generateToken(user, userRoles, userPermissions))
                    .refreshToken(refreshToken.getToken())
                    .build();

            log.info("Successfully logged in user {} with new JWT tokens", user.getUsername());
            return response;
        }

        log.warn("No user found for email {}. Checking signup policy for institute {}", email, instituteId);
        InstituteSignupPolicy signupPolicy = institutePolicyService.fetchSignupPolicy(instituteId);
        log.debug("Signup policy fetched for institute {}: {}", instituteId, signupPolicy);

        if (signupPolicy != null) {
            if ("manual".equalsIgnoreCase(signupPolicy.getPasswordStrategy())) {
                log.warn("Signup policy requires manual password strategy. Cannot auto-create user.");
                return null;
            }
            log.info("Creating new user as per institute signup policy...");
            createUserFromPolicy(signupPolicy, fullName, email, instituteId);
            return loginUserByEmail(fullName, email, instituteId);
        }

        log.error("No user found and no valid signup policy for institute {}", instituteId);
        return null;
    }

    private void createUserFromPolicy(InstituteSignupPolicy signupPolicy, String fullName, String email, String instituteId) throws Exception {
        log.info("Creating user from signup policy for instituteId={} email={}", instituteId, email);

        UserDTO userDTO = new UserDTO();
        userDTO.setEmail(email);
        userDTO.setFullName(fullName);

        if ("email".equalsIgnoreCase(signupPolicy.getUserNameStrategy())) {
            userDTO.setUsername(email);
            log.debug("Username strategy is 'email', setting username={}", email);
        }

        if (signupPolicy.isAllowLearnersToCreateCourses()) {
            userDTO.setRoles(List.of("STUDENT", "TEACHER"));
            log.debug("Signup policy allows learners to create courses. Assigning roles STUDENT, TEACHER");
        } else {
            userDTO.setRoles(List.of("STUDENT"));
            log.debug("Assigning role STUDENT only");
        }

        boolean sendPassword = signupPolicy.getPasswordDelivery() != null &&
                !"none".equalsIgnoreCase(signupPolicy.getPasswordDelivery());

        log.info("Invoking authService.createUser with sendPassword={} for userDTO={}", sendPassword, userDTO);
        authService.createUser(userDTO, instituteId, sendPassword);
        log.info("User created successfully via signup policy for email={}", email);
    }

    public void signUpUser(UserDTO userDTO, String instituteId, boolean sendNotification) throws Exception {
        log.info("Manually signing up user {} for institute {} with sendNotification={}", userDTO.getEmail(), instituteId, sendNotification);
        authService.createUser(userDTO, instituteId, sendNotification);
        log.info("User {} signed up successfully", userDTO.getEmail());
    }

    public JwtResponseDto createUserAndLogin(String fullName, String email, String instituteId) throws Exception {
        log.info("Creating new user and logging in via OAuth2 for email={} instituteId={}", email, instituteId);

        InstituteSignupPolicy signupPolicy = institutePolicyService.fetchSignupPolicy(instituteId);
        log.debug("Signup policy fetched for institute {}: {}", instituteId, signupPolicy);

        if (signupPolicy == null) {
            log.error("No signup policy found for institute {}", instituteId);
            throw new RuntimeException("Institute policy not found");
        }
        if ("manual".equalsIgnoreCase(signupPolicy.getPasswordStrategy())) {
            log.error("Manual password strategy is not allowed for OAuth2 login");
            throw new RuntimeException("Manual password strategy not allowed for OAuth2");
        }

        createUserFromPolicy(signupPolicy, fullName, email, instituteId);
        log.info("User created successfully. Proceeding to login...");
        return loginUserByEmail(fullName, email, instituteId);
    }
}
