package vacademy.io.auth_service.feature.auth.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.auth_service.feature.auth.dto.JwtResponseDto;
import vacademy.io.auth_service.feature.auth.manager.LearnerAuthManager;
import vacademy.io.auth_service.feature.auth.service.UserDetailsCacheService;
import vacademy.io.common.auth.dto.UserServiceDTO;
import vacademy.io.common.auth.dto.learner.UserWithJwtDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.service.UserActivityTrackingService;

import java.util.stream.Collectors;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("auth-service/v1/internal")
public class AuthInternalController {

    @Autowired
    UserActivityTrackingService userActivityTrackingService;

    @Autowired
    UserDetailsCacheService userDetailsCacheService;

    @Autowired
    private LearnerAuthManager learnerAuthManager;

    @GetMapping("/user")
    public ResponseEntity<UserServiceDTO> getUserDetails(@RequestParam String userName,
            @RequestParam(required = false) String serviceName,
            @RequestParam(required = false) String sessionToken,
            HttpServletRequest request) {
        long startTime = System.currentTimeMillis();

        String smallCaseUsername = StringUtils.trimAllWhitespace(userName);

        String usernameWithoutInstitute = smallCaseUsername;
        String instituteId = null;

        // Split only into 2 parts: before first '@' and the rest
        String[] stringUsernameSplit = smallCaseUsername.split("@", 2);

        if (stringUsernameSplit.length == 2) {
            instituteId = stringUsernameSplit[0];
            usernameWithoutInstitute = stringUsernameSplit[1];
        }

        CustomUserDetails customUserDetails = userDetailsCacheService.getCustomUserDetails(usernameWithoutInstitute,
                instituteId);

        // Track user activity asynchronously
        long responseTime = System.currentTimeMillis() - startTime;
        String ipAddress = getClientIpAddress(request);
        String userAgent = request.getHeader("User-Agent");

        userActivityTrackingService.logUserActivity(
                customUserDetails.getUserId(),
                instituteId,
                serviceName != null ? serviceName : "auth-service",
                "/auth-service/v1/internal/user",
                "USER_VERIFICATION",
                sessionToken,
                ipAddress,
                userAgent,
                200,
                responseTime);

        // Create or update session if session token is provided
        if (sessionToken != null && instituteId != null) {
            userActivityTrackingService.createOrUpdateSession(
                    customUserDetails.getUserId(),
                    instituteId,
                    sessionToken,
                    ipAddress,
                    userAgent);
        }

        // Convert CustomUserDetails to UserServiceDTO to avoid Redis serialization
        // issues
        UserServiceDTO userServiceDTO = convertToUserServiceDTO(customUserDetails);

        return ResponseEntity.ok(userServiceDTO);
    }

    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedForHeader = request.getHeader("X-Forwarded-For");
        if (xForwardedForHeader != null && !xForwardedForHeader.isEmpty()) {
            return xForwardedForHeader.split(",")[0].trim();
        }

        String xRealIpHeader = request.getHeader("X-Real-IP");
        if (xRealIpHeader != null && !xRealIpHeader.isEmpty()) {
            return xRealIpHeader;
        }

        return request.getRemoteAddr();
    }

    /**
     * Convert CustomUserDetails to UserServiceDTO to avoid Redis serialization
     * metadata
     * leaking into HTTP responses
     */
    private UserServiceDTO convertToUserServiceDTO(CustomUserDetails customUserDetails) {
        UserServiceDTO dto = new UserServiceDTO();
        dto.setUsername(customUserDetails.getUsername());
        dto.setUserId(customUserDetails.getUserId());
        dto.setEnabled(customUserDetails.isEnabled());

        // Convert authorities to DTO format
        if (customUserDetails.getAuthorities() != null) {
            dto.setAuthorities(customUserDetails.getAuthorities().stream()
                    .map(authority -> new UserServiceDTO.Authority(authority.getAuthority()))
                    .collect(Collectors.toList()));
        }

        return dto;
    }

    @GetMapping("/generate-token-for-learner")
    public ResponseEntity<UserWithJwtDTO> generateTokenForLearner(@RequestParam String userId,
            @RequestParam String instituteId) {
        return ResponseEntity.ok(learnerAuthManager.generateTokenForUserByUserId(userId, instituteId));
    }

}
