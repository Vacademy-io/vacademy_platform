package vacademy.io.notification_service.features.announcements.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import vacademy.io.common.auth.entity.User;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthServiceClient {

    private final RestTemplate restTemplate;

    @Value("${auth.server.baseurl}")
    private String authServiceBaseUrl;

    /**
     * Get users by role for a specific institute - with caching and retry
     */
    // @Cacheable(value = "usersByRole", key = "#instituteId + '_' + #roleName") // Disabled to prevent stale data in shared cache environments
    @Retryable(value = {RestClientException.class}, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public List<User> getUsersByRole(String instituteId, String roleName) {
        log.debug("Calling auth service to get users by role: {} for institute: {}", roleName, instituteId);
        
        try {
            String url = UriComponentsBuilder.fromHttpUrl(authServiceBaseUrl + "/auth-service/v1/users/by-role")
                    .queryParam("instituteId", instituteId)
                    .queryParam("roleName", roleName)
                    .toUriString();

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<List<User>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    new ParameterizedTypeReference<List<User>>() {}
            );

            List<User> users = response.getBody();
            if (users == null) {
                users = new ArrayList<>();
            }
            
            log.debug("Found {} users with role: {} in institute: {}", users.size(), roleName, instituteId);
            return users;
            
        } catch (Exception e) {
            log.error("Error calling auth service for users by role: {} in institute: {}", roleName, instituteId, e);
            return new ArrayList<>(); // Return empty list on error to avoid failing entire announcement
        }
    }

    /**
     * Get users by list of IDs in batches - with caching and retry
     */
    @Retryable(value = {RestClientException.class}, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public List<User> getUsersByIds(List<String> userIds) {
        log.debug("Calling auth service to get {} users by IDs", userIds.size());
        
        if (userIds == null || userIds.isEmpty()) {
            return new ArrayList<>();
        }
        
        try {
            String url = authServiceBaseUrl + "/auth-service/v1/users/by-ids";
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            Map<String, Object> requestBody = Map.of("userIds", userIds);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<List<User>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<List<User>>() {}
            );

            List<User> users = response.getBody();
            if (users == null) {
                users = new ArrayList<>();
            }
            
            log.debug("Found {} users out of {} requested IDs", users.size(), userIds.size());
            return users;
            
        } catch (Exception e) {
            log.error("Error calling auth service for users by IDs", e);
            return new ArrayList<>(); // Return empty list on error
        }
    }

    /**
     * Get users by IDs in batches to avoid large payloads
     */
    public List<User> getUsersByIdsInBatches(List<String> userIds, int batchSize) {
        if (userIds == null || userIds.isEmpty()) {
            return new ArrayList<>();
        }
        
        List<User> allUsers = new ArrayList<>();
        
        // Process in batches
        for (int i = 0; i < userIds.size(); i += batchSize) {
            int endIndex = Math.min(i + batchSize, userIds.size());
            List<String> batch = userIds.subList(i, endIndex);
            
            log.debug("Processing batch {}-{} of {} user IDs", i + 1, endIndex, userIds.size());
            List<User> batchUsers = getUsersByIds(batch);
            allUsers.addAll(batchUsers);
        }
        
        log.debug("Retrieved {} users total from {} batches", allUsers.size(), 
                (userIds.size() + batchSize - 1) / batchSize);
        
        return allUsers;
    }

    /**
     * Get user by email address - for resolving email exclusions to user IDs
     */
    @Retryable(value = {RestClientException.class}, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public User getUserByEmail(String email) {
        log.debug("Calling auth service to get user by email: {}", email);
        
        if (email == null || email.trim().isEmpty()) {
            return null;
        }
        
        try {
            String url = UriComponentsBuilder.fromHttpUrl(authServiceBaseUrl + "/auth-service/open/user-details/by-email")
                    .queryParam("emailId", email.trim())
                    .toUriString();

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            );

            Map<String, Object> userData = response.getBody();
            if (userData == null) {
                return null;
            }
            
            // Convert Map to User object
            User user = new User();
            user.setId((String) userData.get("id"));
            user.setEmail((String) userData.get("email"));
            user.setFullName((String) userData.get("full_name"));
            user.setMobileNumber((String) userData.get("mobile_number"));
            
            if (user.getId() != null) {
                log.debug("Found user with email: {} -> user ID: {}", email, user.getId());
                return user;
            } else {
                log.debug("No user found with email: {}", email);
                return null;
            }
            
        } catch (Exception e) {
            log.error("Error calling auth service for user by email: {}", email, e);
            return null; // Return null on error
        }
    }

    /**
     * Resolve a user by username (case-insensitive). Returns null when unavailable.
     */
    @Retryable(value = {RestClientException.class}, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public User getUserByUsername(String username, String instituteId) {
        if (!StringUtils.hasText(username) || !StringUtils.hasText(instituteId)) {
            return null;
        }

        String trimmedUsername = username.trim();
        String trimmedInstituteId = instituteId.trim();

        String[] portals = {"ADMIN", "LEARNER"};
        for (String portal : portals) {
            try {
                String url = UriComponentsBuilder
                        .fromHttpUrl(authServiceBaseUrl + "/auth-service/open/user-details/by-username")
                        .queryParam("username", trimmedUsername)
                        .queryParam("portal", portal)
                        .queryParam("instituteId", trimmedInstituteId)
                        .toUriString();

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                HttpEntity<String> entity = new HttpEntity<>(headers);

                ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                        url,
                        HttpMethod.GET,
                        entity,
                        new ParameterizedTypeReference<Map<String, Object>>() {}
                );

                Map<String, Object> userData = response.getBody();
                if (userData == null || userData.get("id") == null) {
                    continue;
                }

                User user = new User();
                user.setId((String) userData.get("id"));
                user.setUsername((String) userData.get("username"));
                user.setEmail((String) userData.get("email"));
                user.setMobileNumber((String) userData.get("mobile_number"));

                log.debug("Resolved username {} for institute {} using portal {} -> user ID {}",
                        trimmedUsername, trimmedInstituteId, portal, user.getId());
                return user;

            } catch (HttpClientErrorException.NotFound notFound) {
                log.debug("Username {} not found in portal {} for institute {}", trimmedUsername, portal, trimmedInstituteId);
            } catch (RestClientException e) {
                log.warn("Error resolving username {} in portal {} for institute {}: {}",
                        trimmedUsername, portal, trimmedInstituteId, e.getMessage());
            }
        }

        log.warn("Unable to resolve user for username {} in institute {}", trimmedUsername, trimmedInstituteId);
        return null;
    }
}