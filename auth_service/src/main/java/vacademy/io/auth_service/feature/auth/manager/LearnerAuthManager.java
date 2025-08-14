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
import org.springframework.util.StringUtils;
import vacademy.io.auth_service.feature.auth.constants.AuthConstants;
import vacademy.io.auth_service.feature.auth.dto.AuthRequestDto;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.auth.enums.ClientNameEnum;
import vacademy.io.auth_service.feature.auth.service.AuthService;
import vacademy.io.auth_service.feature.notification.service.NotificationEmailBody;
import vacademy.io.auth_service.feature.notification.service.NotificationService;
import vacademy.io.auth_service.feature.util.UsernameGenerator;
import vacademy.io.auth_service.feature.admin_core_service.dto.InstituteSignupPolicy;
import vacademy.io.auth_service.feature.admin_core_service.service.InstitutePolicyService;
import vacademy.io.common.auth.dto.RefreshTokenRequestDTO;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollRequestDTO;
import vacademy.io.common.auth.entity.*;
import vacademy.io.common.auth.enums.UserRoleStatus;
import vacademy.io.common.auth.repository.RoleRepository;
import vacademy.io.common.auth.repository.UserPermissionRepository;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.auth.service.JwtService;
import vacademy.io.common.auth.service.RefreshTokenService;
import vacademy.io.common.auth.service.OAuth2VendorToUserDetailService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.notification.dto.GenericEmailRequest;
import vacademy.io.common.notification.dto.EmailOTPRequest;
import vacademy.io.common.exceptions.ExpiredTokenException;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Component
public class LearnerAuthManager {

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
    private InternalClientUtils internalClientUtils;

    @Autowired
    private OAuth2VendorToUserDetailService oAuth2VendorToUserDetailService;

    @Autowired
    private InstitutePolicyService institutePolicyService;

    @Value("${admin.core.service.base_url}")
    private String adminCoreServiceBaseUrl;

    @Value("${spring.application.name}")
    private String applicationName;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserPermissionRepository userPermissionRepository;

    public JwtResponseDto registerLearner(LearnerEnrollRequestDTO learnerEnrollRequestDTO) {
        if (learnerEnrollRequestDTO == null) {
            throw new VacademyException("Invalid Request");
        }

        UserDTO userDTO = learnerEnrollRequestDTO.getUser();
        if (userDTO == null) {
            throw new VacademyException("User details are missing");
        }

        String instituteId = learnerEnrollRequestDTO.getInstituteId();
        User user;

        // Check institute policy if instituteId is provided
        if (instituteId != null && !instituteId.isBlank()) {
            InstituteSignupPolicy signupPolicy = institutePolicyService.fetchSignupPolicy(instituteId);
            if (signupPolicy != null && signupPolicy.getUserNameStrategy() != null
                    && signupPolicy.getUserNameStrategy().equalsIgnoreCase("email")) {
                if (userDTO.getEmail() != null) {
                    userDTO.setUsername(userDTO.getEmail());
                }
            }
            boolean deliverPassword = signupPolicy != null
                    && signupPolicy.getPasswordDelivery() != null
                    && !signupPolicy.getPasswordDelivery().equalsIgnoreCase("none");

            user = authService.createUser(userDTO, instituteId, deliverPassword);
        } else {
            user = authService.createUser(userDTO, null, true);
        }

        if (user != null) {
            userDTO.setId(user.getId());
            userDTO.setUsername(user.getUsername());
        }

        if (learnerEnrollRequestDTO.getLearnerPackageSessionEnroll() != null) {
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    applicationName, HttpMethod.POST.name(),
                    adminCoreServiceBaseUrl, AuthConstants.LEARNER_ENROLL_PATH,
                    learnerEnrollRequestDTO);

            try {
                new ObjectMapper().readValue(response.getBody(), new TypeReference<LearnerEnrollResponseDTO>() {});
            } catch (JsonProcessingException e) {
                throw new VacademyException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Failed to register learner: " + e.getMessage());
            }
        } else {
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    applicationName, HttpMethod.POST.name(),
                    adminCoreServiceBaseUrl, AuthConstants.ADD_LEARNER,
                    userDTO);

            // Response might be null, handle gracefully
            String responseInstituteId = (response != null) ? response.getBody() : null;
        }

        // Verify email if data is available
        if (learnerEnrollRequestDTO.getSubjectId() != null &&
                learnerEnrollRequestDTO.getVendorId() != null &&
                user != null && user.getEmail() != null) {
            oAuth2VendorToUserDetailService.verifyEmail(
                    learnerEnrollRequestDTO.getSubjectId(),
                    learnerEnrollRequestDTO.getVendorId(),
                    user.getEmail()
            );
        }

        RefreshToken refreshToken = refreshTokenService.createRefreshToken(
                (user != null) ? user.getUsername() : null,
                "VACADEMY-WEB"
        );

        return authService.generateJwtTokenForUser(
                user,
                refreshToken,
                (user != null && user.getRoles() != null) ? user.getRoles().stream().toList() : List.of()
        );
    }


    private User createUser(UserDTO userDTO) {
        User user = new User();

        user.setUsername(
                StringUtils.hasText(userDTO.getUsername())
                        ? userDTO.getUsername()
                        : UsernameGenerator.generateUsername(userDTO.getFullName()));

        user.setPassword(
                StringUtils.hasText(userDTO.getPassword())
                        ? userDTO.getPassword()
                        : UsernameGenerator.generatePassword(8));

        user.setEmail(userDTO.getEmail());
        user.setFullName(userDTO.getFullName());
        user.setAddressLine(userDTO.getAddressLine());
        user.setCity(userDTO.getCity());
        user.setPinCode(userDTO.getPinCode());
        user.setMobileNumber(userDTO.getMobileNumber());
        user.setDateOfBirth(userDTO.getDateOfBirth());
        user.setGender(userDTO.getGender());
        user.setRootUser(userDTO.isRootUser());

        return userRepository.save(user);
    }

    public void sendWelcomeMailToUser(User user) {
        GenericEmailRequest emailRequest = new GenericEmailRequest();
        emailRequest.setTo(user.getEmail());
        emailRequest.setSubject("Welcome to Vacademy");
        emailRequest.setBody(NotificationEmailBody.createWelcomeEmailBody("Vacademy", user.getFullName(),
                user.getUsername(), user.getPassword()));
        notificationService.sendGenericHtmlMail(emailRequest);
    }

    public JwtResponseDto loginUser(AuthRequestDto authRequestDTO) {
        String userName = authRequestDTO.getUserName();
        String password = authRequestDTO.getPassword();

        Authentication authentication = authRequestDTO.getInstituteId() == null
                ? authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(userName, password))
                : authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(
                        authRequestDTO.getInstituteId() + "@" + userName, password));

        if (!authentication.isAuthenticated())
            throw new UsernameNotFoundException("Invalid user request!");

        User user = userRepository.findByUsername(userName)
                .orElseThrow(() -> new UsernameNotFoundException("Invalid user request!"));

        refreshTokenService.deleteAllRefreshToken(user);

        List<UserRole> roles = userRoleRepository.findUserRolesByUserIdAndStatusesAndRoleNames(user.getId(),
                List.of(UserRoleStatus.ACTIVE.name()), AuthConstants.VALID_ROLES_FOR_STUDENT_PORTAL);
        if (roles.isEmpty())
            throw new UsernameNotFoundException("Invalid user request!");

        List<String> permissions = userPermissionRepository.findByUserId(user.getId()).stream()
                .map(UserPermission::getPermissionId).toList();

        RefreshToken refreshToken = refreshTokenService.createRefreshToken(userName, authRequestDTO.getClientName());

        return JwtResponseDto.builder()
                .accessToken(jwtService.generateToken(user, user.getRoles().stream().toList(), permissions))
                .refreshToken(refreshToken.getToken())
                .build();
    }

    public String requestOtp(AuthRequestDto authRequestDTO) {
        Optional<User> user = null;
        if (authRequestDTO.getClientName() != null
                && authRequestDTO.getClientName().equals(ClientNameEnum.ADMIN.name())) {
            user = userRepository.findMostRecentUserByEmailAndRoleStatusAndRoleNames(authRequestDTO.getEmail(),
                    List.of(UserRoleStatus.ACTIVE.name(), UserRoleStatus.INVITED.name()),
                    AuthConstants.VALID_ROLES_FOR_ADMIN_PORTAL);
        } else {
            user = userRepository.findMostRecentUserByEmailAndRoleStatusAndRoleNames(authRequestDTO.getEmail(),
                    List.of(UserRoleStatus.ACTIVE.name(), UserRoleStatus.INVITED.name()),
                    AuthConstants.VALID_ROLES_FOR_STUDENT_PORTAL);
        }

        if (user.isEmpty())
            throw new UsernameNotFoundException("User not found!");

        notificationService.sendOtp(makeOtp(authRequestDTO.getEmail()));
        return "OTP sent to " + authRequestDTO.getEmail();
    }

    public JwtResponseDto loginViaOtp(AuthRequestDto authRequestDTO) {
        if (authRequestDTO.getOtp() == null)
            throw new UsernameNotFoundException("Invalid OTP!");

        boolean isValid = notificationService.verifyOTP(
                EmailOTPRequest.builder().otp(authRequestDTO.getOtp()).to(authRequestDTO.getEmail()).build());
        if (!isValid)
            throw new UsernameNotFoundException("Invalid OTP!");

        User user = userRepository
                .findMostRecentUserByEmailAndRoleStatusAndRoleNames(authRequestDTO.getEmail(),
                        List.of(UserRoleStatus.ACTIVE.name(), UserRoleStatus.INVITED.name()),
                        AuthConstants.VALID_ROLES_FOR_STUDENT_PORTAL)
                .orElseThrow(() -> new VacademyException("User not found!!!"));

        Authentication authentication = authRequestDTO.getInstituteId() == null
                ? authenticationManager
                        .authenticate(new UsernamePasswordAuthenticationToken(user.getUsername(), user.getPassword()))
                : authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(
                        authRequestDTO.getInstituteId() + "@" + user.getUsername(), user.getPassword()));

        if (!authentication.isAuthenticated())
            throw new UsernameNotFoundException("Authentication failed!");

        refreshTokenService.deleteAllRefreshToken(user);

        List<String> permissions = userPermissionRepository.findByUserId(user.getId()).stream()
                .map(UserPermission::getPermissionId).toList();
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(user.getUsername(),
                authRequestDTO.getClientName());

        return JwtResponseDto.builder()
                .accessToken(jwtService.generateToken(user, user.getRoles().stream().toList(), permissions))
                .refreshToken(refreshToken.getToken())
                .build();
    }

    public JwtResponseDto refreshToken(RefreshTokenRequestDTO refreshTokenRequestDTO) {
        return refreshTokenService.findByToken(refreshTokenRequestDTO.getToken())
                .map(refreshTokenService::verifyExpiration)
                .map(RefreshToken::getUserInfo)
                .map(user -> {
                    List<String> permissions = userPermissionRepository.findByUserId(user.getId()).stream()
                            .map(UserPermission::getPermissionId).toList();
                    return JwtResponseDto.builder()
                            .accessToken(jwtService.generateToken(user, user.getRoles().stream().toList(), permissions))
                            .build();
                })
                .orElseThrow(() -> new ExpiredTokenException("Refresh token is expired. Please log in again."));
    }

    private EmailOTPRequest makeOtp(String email) {
        return EmailOTPRequest.builder()
                .to(email)
                .service("auth-service")
                .subject("Vacademy | OTP Verification")
                .name("Vacademy User")
                .build();
    }
}
