package vacademy.io.admin_core_service.core.config;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.sentry.Sentry;
import io.sentry.SentryLevel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import vacademy.io.common.auth.constants.AuthConstant;
import vacademy.io.common.auth.dto.UserServiceDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

@Slf4j
@Component
public class UserDetailsServiceImpl implements UserDetailsService {

    @Value(value = "${spring.application.name}")
    String clientName;
    @Value(value = "${auth.server.baseurl}")
    String authServerBaseUrl;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private InternalClientUtils internalClientUtils;

    @Override
    @Cacheable(value = "userDetails", key = "#username")
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        log.debug("Entering in loadUserByUsername Method for username: {}", username);
        log.info("Fetching user details for: {} (This should be cached for 5 minutes)", username);

        // Extract session token from SecurityContext if available
        String sessionToken = extractSessionToken();

        // Build endpoint URL with service name and optional session token
        String endpoint = AuthConstant.userServiceRoute
                + "?userName=" + username
                + "&serviceName=" + clientName
                + (sessionToken != null ? "&sessionToken=" + sessionToken : "");

        try {
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.GET.name(),
                    authServerBaseUrl,
                    endpoint,
                    null);

            ObjectMapper objectMapper = new ObjectMapper();

            try {
                UserServiceDTO customUserDetails = objectMapper.readValue(response.getBody(), UserServiceDTO.class);
                log.info("User Authenticated Successfully for: {}", username);
                return new CustomUserDetails(customUserDetails);
            } catch (JsonProcessingException e) {
                log.error("Failed to parse user details response for username: {}", username, e);

                // Capture JSON parsing failures in Sentry
                Sentry.withScope(scope -> {
                    scope.setLevel(SentryLevel.ERROR);
                    scope.setTag("error_type", "json_parsing_error");
                    scope.setTag("service", "admin_core_service");
                    scope.setTag("operation", "loadUserByUsername");
                    scope.setExtra("username", username);
                    scope.setExtra("auth_service_url", authServerBaseUrl + endpoint);
                    Sentry.captureException(e);
                });

                throw new RuntimeException("Failed to parse user details: " + e.getMessage(), e);
            }
        } catch (Exception e) {
            // Log detailed error information
            log.error("Failed to load user details for username: {} from auth service at: {}. Error: {}",
                    username, authServerBaseUrl + endpoint, e.getMessage());
            log.error("This request should have been cached for 5 minutes. Possible causes: " +
                    "1) Cache miss (first request or cache expired), " +
                    "2) Auth service unreachable, " +
                    "3) Network connectivity issue", e);

            // Capture auth service connectivity failures in Sentry
            Sentry.withScope(scope -> {
                scope.setLevel(SentryLevel.ERROR);
                scope.setTag("error_type", "auth_service_unreachable");
                scope.setTag("service", clientName);
                scope.setTag("operation", "loadUserByUsername");
                scope.setTag("cache_status", "cache_miss_or_expired");
                scope.setExtra("username", username);
                scope.setExtra("auth_service_url", authServerBaseUrl + endpoint);
                scope.setExtra("error_message", e.getMessage());
                scope.setExtra("error_class", e.getClass().getName());
                scope.setExtra("expected_behavior", "This should be cached for 5 minutes");
                scope.setExtra("possible_cause_1", "Cache miss (first request or cache expired)");
                scope.setExtra("possible_cause_2", "Auth service unreachable");
                scope.setExtra("possible_cause_3", "Network connectivity issue");
                scope.setExtra("possible_cause_4", "DNS resolution failure");
                Sentry.captureException(e);
            });

            throw new UsernameNotFoundException(
                    "Unable to load user details for: " + username + ". Auth service might be unavailable.", e);
        }
    }

    /**
     * Extract session token from current security context
     * This can be enhanced based on your session management strategy
     */
    private String extractSessionToken() {
        try {
            // First, try to get from request attributes (set by JWT filter)
            RequestAttributes requestAttributes = RequestContextHolder.getRequestAttributes();
            if (requestAttributes instanceof ServletRequestAttributes) {
                HttpServletRequest request = ((ServletRequestAttributes) requestAttributes).getRequest();

                // Check if JWT filter set the session token
                String sessionToken = (String) request.getAttribute("sessionToken");
                if (sessionToken != null) {
                    return sessionToken;
                }

                // Fallback: Extract from Authorization header
                String authHeader = request.getHeader("Authorization");
                if (authHeader != null && authHeader.startsWith("Bearer ")) {
                    return generateSessionIdFromToken(authHeader.substring(7));
                }

                // Fallback: HTTP session
                HttpSession session = request.getSession(false);
                if (session != null) {
                    return session.getId();
                }
            }

            return null;
        } catch (Exception e) {
            log.debug("Could not extract session token: {}", e.getMessage());
            return null;
        }
    }

    private String generateSessionIdFromToken(String token) {
        // Generate consistent session ID from JWT token
        return "session_" + Integer.toHexString(token.hashCode());
    }

}
