package vacademy.io.auth_service.feature.auth.manager;

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
        Optional<User> userOptional = userRepository.findMostRecentUserByEmailAndRoleStatusAndRoleNames(
                email,
                List.of(UserRoleStatus.ACTIVE.name(), UserRoleStatus.INVITED.name()),
                AuthConstants.VALID_ROLES_FOR_STUDENT_PORTAL
        );

        if (userOptional.isPresent()) {
            User user = userOptional.get();
            refreshTokenService.deleteAllRefreshToken(user);

            List<UserRole> userRoles = userRoleRepository.findByUserAndStatusAndRoleName(
                    user,
                    UserRoleStatus.ACTIVE.name(),
                    "STUDENT"
            );

            // If user exists but doesn't have a STUDENT role → handle policy
            if (userRoles.isEmpty()) {
                InstituteSignupPolicy signupPolicy = institutePolicyService.fetchSignupPolicy(instituteId);
                if (signupPolicy != null) {
                    if ("manual".equalsIgnoreCase(signupPolicy.getPasswordStrategy())) {
                        return null; // Manual signup required
                    }
                    createUserFromPolicy(signupPolicy, fullName, email, instituteId);
                    return loginUserByEmail(fullName, email, instituteId);
                }
            }

            // User exists and has roles → generate tokens
            RefreshToken refreshToken = refreshTokenService.createRefreshToken(user.getUsername(), "oauth2-client");
            List<String> userPermissions = userPermissionRepository.findByUserId(user.getId())
                    .stream()
                    .map(UserPermission::getPermissionId)
                    .toList();

            return JwtResponseDto.builder()
                    .accessToken(jwtService.generateToken(user, userRoles, userPermissions))
                    .refreshToken(refreshToken.getToken())
                    .build();
        }

        // User not found → check policy
        InstituteSignupPolicy signupPolicy = institutePolicyService.fetchSignupPolicy(instituteId);
        if (signupPolicy != null) {
            if ("manual".equalsIgnoreCase(signupPolicy.getPasswordStrategy())) {
                return null; // Manual signup required
            }
            createUserFromPolicy(signupPolicy, fullName, email, instituteId);
            return loginUserByEmail(fullName, email, instituteId);
        }

        return null; // Policy not found
    }

    private void createUserFromPolicy(InstituteSignupPolicy signupPolicy, String fullName, String email, String instituteId) throws Exception {
        UserDTO userDTO = new UserDTO();
        userDTO.setEmail(email);
        userDTO.setFullName(fullName);

        if ("email".equalsIgnoreCase(signupPolicy.getUserNameStrategy())) {
            userDTO.setUsername(email);
        }

        if (signupPolicy.isAllowLearnersToCreateCourses()) {
            userDTO.setRoles(List.of("STUDENT", "TEACHER"));
        } else {
            userDTO.setRoles(List.of("STUDENT"));
        }

        authService.createUser(
                userDTO,
                instituteId,
                signupPolicy.getPasswordDelivery() != null &&
                        !"none".equalsIgnoreCase(signupPolicy.getPasswordDelivery())
        );
    }

    public void signUpUser(UserDTO userDTO, String instituteId, boolean sendNotification) throws Exception {
        authService.createUser(userDTO, instituteId, sendNotification);
    }

    public JwtResponseDto createUserAndLogin(String fullName, String email, String instituteId) throws Exception {
        InstituteSignupPolicy signupPolicy = institutePolicyService.fetchSignupPolicy(instituteId);
        if (signupPolicy == null) {
            throw new RuntimeException("Institute policy not found");
        }
        if ("manual".equalsIgnoreCase(signupPolicy.getPasswordStrategy())) {
            throw new RuntimeException("Manual password strategy not allowed for OAuth2");
        }
        createUserFromPolicy(signupPolicy, fullName, email, instituteId);
        return loginUserByEmail(fullName, email, instituteId);
    }
}
