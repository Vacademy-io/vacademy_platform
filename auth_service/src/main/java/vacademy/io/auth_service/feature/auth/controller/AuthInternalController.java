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
import vacademy.io.common.auth.dto.learner.UserWithJwtDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.service.UserActivityTrackingService;

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
    public ResponseEntity<CustomUserDetails> getUserDetails(@RequestParam String userName,
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

        CustomUserDetails customUserDetails = userDetailsCacheService.getCustomUserDetails(usernameWithoutInstitute, instituteId);

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
                responseTime
        );

        // Create or update session if session token is provided
        if (sessionToken != null && instituteId != null) {
            userActivityTrackingService.createOrUpdateSession(
                    customUserDetails.getUserId(),
                    instituteId,
                    sessionToken,
                    ipAddress,
                    userAgent
            );
        }

        return ResponseEntity.ok(customUserDetails);
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

    @GetMapping("/generate-token-for-learner")
    public ResponseEntity<UserWithJwtDTO> generateTokenForLearner(@RequestParam String userId,
                                                                  @RequestParam String instituteId) {
        return ResponseEntity.ok(learnerAuthManager.generateTokenForUserByUserId(userId, instituteId));
    }


}
