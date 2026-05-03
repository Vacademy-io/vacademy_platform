package vacademy.io.auth_service.feature.auth.manager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.auth_service.feature.auth.constants.AuthConstants;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.auth.dto.VimotionSignupRequest;
import vacademy.io.auth_service.feature.auth.dto.VimotionVerifyOtpRequest;
import vacademy.io.auth_service.feature.auth.dto.VimotionVerifyOtpResponse;
import vacademy.io.auth_service.feature.auth.dto.WhatsAppOTPVerifyRequest;
import vacademy.io.auth_service.feature.auth.service.AuthService;
import vacademy.io.auth_service.feature.auth.service.VimotionSignupTokenService;
import vacademy.io.auth_service.feature.notification.service.NotificationService;
import vacademy.io.auth_service.feature.util.UsernameGenerator;
import vacademy.io.common.auth.entity.RefreshToken;
import vacademy.io.common.auth.entity.Role;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.repository.RoleRepository;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.service.RefreshTokenService;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.InstituteIdAndNameDTO;
import vacademy.io.common.institute.dto.InstituteInfoDTO;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static vacademy.io.auth_service.feature.auth.constants.AuthConstants.ADMIN_ROLE;

@Component
public class VimotionAuthManager {

    private static final String PRODUCT_VIMOTION = "vimotion";
    private static final Set<String> VALID_ACCOUNT_TYPES = Set.of("individual", "studio", "agency");

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private VimotionSignupTokenService signupTokenService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private AuthService authService;

    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${admin.core.service.base_url}")
    private String adminCoreServiceBaseUrl;

    @Value("${spring.application.name}")
    private String applicationName;

    public String requestSignupOtp(String phoneNumber) {
        if (!StringUtils.hasText(phoneNumber)) {
            throw new VacademyException("Phone number is required");
        }
        notificationService.sendPlatformDefaultWhatsAppOtp(phoneNumber);
        return "WhatsApp OTP sent to " + phoneNumber;
    }

    public VimotionVerifyOtpResponse verifySignupOtp(VimotionVerifyOtpRequest request) {
        if (request == null
                || !StringUtils.hasText(request.getPhoneNumber())
                || !StringUtils.hasText(request.getOtp())) {
            throw new VacademyException("Phone number and OTP are required");
        }

        WhatsAppOTPVerifyRequest verifyRequest = WhatsAppOTPVerifyRequest.builder()
                .phoneNumber(request.getPhoneNumber())
                .otp(request.getOtp())
                .build();

        boolean isValid = notificationService.verifyWhatsAppOTP(verifyRequest);
        if (!isValid) {
            throw new VacademyException(HttpStatus.UNAUTHORIZED, "Invalid or expired OTP");
        }

        String token = signupTokenService.issue(request.getPhoneNumber(), request.getEmail());
        return VimotionVerifyOtpResponse.builder()
                .signupToken(token)
                .expiresAt(System.currentTimeMillis() + signupTokenService.ttlMillis())
                .build();
    }

    @Transactional
    public JwtResponseDto signup(VimotionSignupRequest request) {
        validateSignupRequest(request);

        Claims claims = signupTokenService.verify(request.getSignupToken(), request.getPhoneNumber());
        // email lock: if the token was issued for a specific email, ensure it matches
        String tokenEmail = claims.get("email", String.class);
        if (StringUtils.hasText(tokenEmail) && !tokenEmail.equalsIgnoreCase(request.getEmail())) {
            throw new VacademyException("Signup token does not match email");
        }

        InstituteInfoDTO instituteDto = buildInstituteDto(request);
        InstituteIdAndNameDTO created = createInstitute(instituteDto);

        Role adminRole = roleRepository.findByName(ADMIN_ROLE)
                .orElseThrow(() -> new VacademyException(HttpStatus.INTERNAL_SERVER_ERROR, "Role 'ADMIN' not found"));

        UserRole userRole = new UserRole();
        userRole.setRole(adminRole);
        userRole.setInstituteId(created.getInstituteId());
        Set<UserRole> userRoles = new HashSet<>();
        userRoles.add(userRole);

        User user = upsertVimotionUser(request, userRoles);

        RefreshToken refreshToken = refreshTokenService.createRefreshToken(user.getUsername(), "VIMOTION-WEB");
        return authService.generateJwtTokenForUser(user, refreshToken, userRoles.stream().toList());
    }

    private void validateSignupRequest(VimotionSignupRequest request) {
        if (request == null) {
            throw new VacademyException("Invalid request");
        }
        if (!StringUtils.hasText(request.getSignupToken())) {
            throw new VacademyException("Missing signup token");
        }
        if (!StringUtils.hasText(request.getFullName())) {
            throw new VacademyException("Full name is required");
        }
        if (!StringUtils.hasText(request.getEmail())) {
            throw new VacademyException("Email is required");
        }
        if (!StringUtils.hasText(request.getPhoneNumber())) {
            throw new VacademyException("Phone number is required");
        }
        String accountType = request.getAccountType();
        if (!StringUtils.hasText(accountType) || !VALID_ACCOUNT_TYPES.contains(accountType.toLowerCase())) {
            throw new VacademyException("account_type must be one of: individual, studio, agency");
        }
        boolean isOrg = !"individual".equalsIgnoreCase(accountType);
        if (isOrg && !StringUtils.hasText(request.getStudioName())) {
            throw new VacademyException("studio_name is required for studio/agency accounts");
        }
    }

    private InstituteInfoDTO buildInstituteDto(VimotionSignupRequest request) {
        boolean isIndividual = "individual".equalsIgnoreCase(request.getAccountType());
        InstituteInfoDTO dto = new InstituteInfoDTO();
        dto.setInstituteName(isIndividual ? request.getFullName() : request.getStudioName());
        dto.setEmail(request.getEmail());
        dto.setPhone(request.getPhoneNumber());
        dto.setProduct(PRODUCT_VIMOTION);
        dto.setAccountType(request.getAccountType().toLowerCase());
        if (!isIndividual) {
            dto.setInstituteLogoFileId(request.getLogoFileId());
            dto.setInstituteThemeCode(request.getBrandColor());
            dto.setCompanySize(request.getCompanySize());
        }
        return dto;
    }

    private InstituteIdAndNameDTO createInstitute(InstituteInfoDTO instituteDto) {
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                applicationName,
                HttpMethod.POST.name(),
                adminCoreServiceBaseUrl,
                AuthConstants.CREATE_INSTITUTES_PATH,
                instituteDto);
        try {
            return new ObjectMapper().readValue(
                    response.getBody(),
                    new TypeReference<InstituteIdAndNameDTO>() {
                    });
        } catch (JsonProcessingException e) {
            throw new VacademyException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to register Vimotion institute: " + e.getMessage());
        }
    }

    private User upsertVimotionUser(VimotionSignupRequest request, Set<UserRole> roles) {
        String normalizedEmail = request.getEmail() == null ? null : request.getEmail().toLowerCase();
        String normalizedPhone = request.getPhoneNumber() == null
                ? null
                : request.getPhoneNumber().replaceAll("[^0-9]", "");

        Optional<User> existing = userRepository.findFirstByEmailOrderByCreatedAtDesc(normalizedEmail);
        User user;
        if (existing.isPresent()) {
            user = existing.get();
            if (!StringUtils.hasText(user.getMobileNumber()) && StringUtils.hasText(normalizedPhone)) {
                user.setMobileNumber(normalizedPhone);
            }
            if (!StringUtils.hasText(user.getFullName()) && StringUtils.hasText(request.getFullName())) {
                user.setFullName(request.getFullName());
            }
            if (!user.isRootUser()) {
                user.setRootUser(true);
            }
            user = userRepository.save(user);
        } else {
            String username = UsernameGenerator.generateUsername(request.getFullName());
            String password = StringUtils.hasText(request.getPassword())
                    ? request.getPassword()
                    : UsernameGenerator.generatePassword(12);
            user = User.builder()
                    .fullName(request.getFullName())
                    .username(username)
                    .email(normalizedEmail)
                    .mobileNumber(normalizedPhone)
                    .password(password)
                    .isRootUser(true)
                    .build();
            user = userRepository.save(user);
        }
        for (UserRole role : roles) {
            role.setUser(user);
        }
        user.setRoles(roles);
        return userRepository.save(user);
    }
}
