package vacademy.io.auth_service.feature.auth.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.auth.service.UserActivityTrackingService;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Optional;


@RestController
@RequestMapping("auth-service/v1/internal")
public class AuthInternalController {


    @Autowired
    UserRepository userRepository;

    @Autowired
    UserRoleRepository userRoleRepository;

    @Autowired
    UserActivityTrackingService userActivityTrackingService;

    @GetMapping("/user")
    public ResponseEntity<CustomUserDetails> getUserDetails(@RequestParam String userName,
                                                            @RequestParam(required = false) String serviceName,
                                                            @RequestParam(required = false) String sessionToken,
                                                            HttpServletRequest request) {
        long startTime = System.currentTimeMillis();

        String smallCaseUsername = StringUtils.trimAllWhitespace(userName).toLowerCase();

        String usernameWithoutInstitute = smallCaseUsername;
        String instituteId = null;

        // Split only into 2 parts: before first '@' and the rest
        String[] stringUsernameSplit = smallCaseUsername.split("@", 2);

        if (stringUsernameSplit.length == 2) {
            instituteId = stringUsernameSplit[0];
            usernameWithoutInstitute = stringUsernameSplit[1];
        }

        Optional<User> user = userRepository.findByUsername(usernameWithoutInstitute);

        if (user.isEmpty()) {
            throw new UsernameNotFoundException("could not found user..!!");
        }

        List<UserRole> userRoles = userRoleRepository.findByUser(user.get());
        CustomUserDetails customUserDetails = new CustomUserDetails(user.get(), instituteId, userRoles);
        customUserDetails.setPassword(null);

        // Track user activity asynchronously
        long responseTime = System.currentTimeMillis() - startTime;
        String ipAddress = getClientIpAddress(request);
        String userAgent = request.getHeader("User-Agent");

        userActivityTrackingService.logUserActivity(
                user.get().getId(),
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
                    user.get().getId(),
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

}
