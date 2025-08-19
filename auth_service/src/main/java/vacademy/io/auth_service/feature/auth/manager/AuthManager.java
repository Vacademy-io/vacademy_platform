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
import vacademy.io.auth_service.feature.auth.enums.ClientNameEnum;
import vacademy.io.auth_service.feature.auth.service.AuthService;
import vacademy.io.auth_service.feature.notification.service.NotificationEmailBody;
import vacademy.io.auth_service.feature.notification.service.NotificationService;
import vacademy.io.common.auth.dto.RefreshTokenRequestDTO;
import vacademy.io.common.auth.entity.*;
import vacademy.io.common.auth.enums.UserRoleStatus;
import vacademy.io.common.auth.repository.RoleRepository;
import vacademy.io.common.auth.repository.UserPermissionRepository;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.auth.service.JwtService;
import vacademy.io.common.auth.service.OAuth2VendorToUserDetailService;
import vacademy.io.common.auth.service.RefreshTokenService;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.ExpiredTokenException;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.InstituteIdAndNameDTO;
import vacademy.io.common.institute.dto.InstituteInfoDTO;
import vacademy.io.common.notification.dto.EmailOTPRequest;
import vacademy.io.common.notification.dto.GenericEmailRequest;

import java.util.*;

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

    @Autowired
    private UserPermissionRepository userPermissionRepository;

    @Autowired
    private OAuth2VendorToUserDetailService oAuth2VendorToUserDetailService;

    public JwtResponseDto registerRootUser(RegisterRequest registerRequest) {
        if (Objects.isNull(registerRequest)) throw new VacademyException("Invalid Request");


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

        allRoles.forEach(role -> {
            UserRole userRole = new UserRole();
            userRole.setRole(role);
            userRole.setInstituteId(customUserDetails.getInstituteId());

            userRoleSet.add(userRole);
        });
        User newUser = authService.createUser(registerRequest, userRoleSet);
        oAuth2VendorToUserDetailService.verifyEmail(registerRequest.getSubjectId(),registerRequest.getVendorId(),registerRequest.getEmail());
        // Generate a refresh token
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(newUser.getUsername(), "VACADEMY-WEB");

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
            if (userOptional.isEmpty()) {
                throw new UsernameNotFoundException("invalid user request..!!");
            }

            refreshTokenService.deleteAllRefreshToken(userOptional.get());

            User user = userOptional.get();

            List<UserRole> allUserRoles = userRoleRepository.findByUser(user);
            Optional<UserRole> nonStudentRole = allUserRoles.stream()
                    .filter(ur -> List.of(UserRoleStatus.ACTIVE.name(), UserRoleStatus.INVITED.name()).contains(ur.getStatus()))
                    .filter(ur -> ur.getRole() != null && ur.getRole().getName() != null && !AuthConstants.STUDENT_ROLE.equals(ur.getRole().getName()))
                    .findFirst();

            // mark as accepted invitation based on Institute for the first eligible non-student role
            if (nonStudentRole.isPresent()) {
                userRoleRepository.updateUserRoleStatusByInstituteIdAndUserId(
                        UserRoleStatus.ACTIVE.name(),
                        nonStudentRole.get().getInstituteId(),
                        List.of(user.getId())
                );
            } else {
                throw new UsernameNotFoundException("invalid user request..!!");
            }

            RefreshToken refreshToken = refreshTokenService.createRefreshToken(authRequestDTO.getUserName(), authRequestDTO.getClientName());
            List<String>userPermissions = userPermissionRepository.findByUserId(user.getId()).stream().map(UserPermission::getPermissionId).toList();
            return JwtResponseDto.builder().accessToken(jwtService.generateToken(user, user.getRoles().stream().toList(),userPermissions)).refreshToken(refreshToken.getToken()).build();

        } else {
            throw new UsernameNotFoundException("invalid user request..!!");
        }
    }

    public JwtResponseDto refreshToken(RefreshTokenRequestDTO refreshTokenRequestDTO) {
        return refreshTokenService.findByToken(refreshTokenRequestDTO.getToken()).map(refreshTokenService::verifyExpiration).map(RefreshToken::getUserInfo).map(userInfo -> {

            List<UserRole> userRoles = userRoleRepository.findByUser(userInfo);
            List<String>userPermissions = userPermissionRepository.findByUserId(userInfo.getId()).stream().map(UserPermission::getPermissionId).toList();
            // Generate new access token
            String accessToken = jwtService.generateToken(userInfo, userRoles,userPermissions);
            // Return the new JWT token
            return JwtResponseDto.builder().accessToken(accessToken).build();
        }).orElseThrow(() -> new ExpiredTokenException(refreshTokenRequestDTO.getToken() + " Refresh token is. Please make a new login..!"));

    }

    public String requestOtp(AuthRequestDto authRequestDTO) {
        Optional<User> user = null;
        if (authRequestDTO.getClientName() != null && authRequestDTO.getClientName().equals(ClientNameEnum.ADMIN.name())) {
            user = userRepository.findMostRecentUserByEmailAndRoleStatusAndRoleNames(authRequestDTO.getEmail(), List.of(UserRoleStatus.ACTIVE.name(),UserRoleStatus.INVITED.name()), AuthConstants.VALID_ROLES_FOR_ADMIN_PORTAL);
        }
        else{
            user = userRepository.findMostRecentUserByEmailAndRoleStatusAndRoleNames(authRequestDTO.getEmail(), List.of(UserRoleStatus.ACTIVE.name(),UserRoleStatus.INVITED.name()), AuthConstants.VALID_ROLES_FOR_STUDENT_PORTAL);
        }
        if (user.isEmpty()) {
            throw new UsernameNotFoundException("invalid user request..!!");
        } else {
            // todo: generate OTP for
            notificationService.sendOtp(makeOtp(authRequestDTO.getEmail()));
            return "OTP sent to " + authRequestDTO.getEmail();
        }

    }

    private EmailOTPRequest makeOtp(String email) {
        return EmailOTPRequest.builder().to(email).service("auth-service").subject("Vacademy | Otp verification. ").name("Vacademy User").build();
    }

    public JwtResponseDto loginViaOtp(AuthRequestDto authRequestDTO) {
        validateOtp(authRequestDTO);
        User user = null;
        if (authRequestDTO.getClientName() != null && authRequestDTO.getClientName().equals(ClientNameEnum.ADMIN.name())) {
            Optional<User> userOptional = userRepository.findMostRecentUserByEmailAndRoleStatusAndRoleNames(authRequestDTO.getEmail(), List.of(UserRoleStatus.ACTIVE.name(),UserRoleStatus.INVITED.name()), AuthConstants.VALID_ROLES_FOR_ADMIN_PORTAL);
            if (userOptional.isEmpty()) {
                throw new VacademyException("invalid user request..!!");
            }
            user = userOptional.get();
        }
        else{
            Optional<User> userOptional = userRepository.findMostRecentUserByEmailAndRoleStatusAndRoleNames(authRequestDTO.getEmail(), List.of(UserRoleStatus.ACTIVE.name(),UserRoleStatus.INVITED.name()), AuthConstants.VALID_ROLES_FOR_STUDENT_PORTAL);
            if (userOptional.isEmpty()) {
                throw new VacademyException("invalid user request..!!");
            }
            user = userOptional.get();
        }
        return generateJwtResponse(authRequestDTO, user);
    }

    private void validateOtp(AuthRequestDto authRequestDTO) {
        if (authRequestDTO.getOtp() == null) {
            throw new UsernameNotFoundException("invalid user request..!!");
        }

        boolean isValidOtp = notificationService.verifyOTP(
                EmailOTPRequest.builder()
                        .otp(authRequestDTO.getOtp())
                        .to(authRequestDTO.getEmail())
                        .build()
        );
        if (!isValidOtp) {
            throw new UsernameNotFoundException("invalid user request..!!");
        }
    }

    private JwtResponseDto generateJwtResponse(AuthRequestDto authRequestDTO, User user) {
        String username = user.getUsername();

        refreshTokenService.deleteAllRefreshToken(user);

        RefreshToken refreshToken = refreshTokenService.createRefreshToken(username, authRequestDTO.getClientName());
        List<String>userPermissions = userPermissionRepository.findByUserId(user.getId()).stream().map(UserPermission::getPermissionId).toList();
        return JwtResponseDto.builder()
                .accessToken(jwtService.generateToken(user, user.getRoles().stream().toList(),userPermissions))
                .refreshToken(refreshToken.getToken())
                .build();
    }

}
