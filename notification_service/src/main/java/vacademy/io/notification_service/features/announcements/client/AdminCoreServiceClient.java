package vacademy.io.notification_service.features.announcements.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminCoreServiceClient {

    private final RestTemplate restTemplate;

    @Value("${admin.core.service.baseurl:http://admin-core-service.vacademy.svc.cluster.local:8072}")
    private String adminCoreServiceBaseUrl;

    /**
     * Get faculty user IDs by package sessions - with caching and retry
     */
    @Cacheable(value = "facultyByPackageSessions", key = "#packageSessionIds.hashCode()")
    @Retryable(value = {RestClientException.class}, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public List<String> getFacultyByPackageSessions(List<String> packageSessionIds) {
        log.debug("Calling admin-core service to get faculty for {} package sessions", packageSessionIds.size());
        
        if (packageSessionIds == null || packageSessionIds.isEmpty()) {
            return new ArrayList<>();
        }
        
        try {
            String url = adminCoreServiceBaseUrl + "/admin-core-service/v1/faculty/by-package-sessions";
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            Map<String, Object> requestBody = Map.of("packageSessionIds", packageSessionIds);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<List<String>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<List<String>>() {}
            );

            List<String> userIds = response.getBody();
            if (userIds == null) {
                userIds = new ArrayList<>();
            }
            
            log.debug("Found {} faculty members across {} package sessions", userIds.size(), packageSessionIds.size());
            return userIds;
            
        } catch (Exception e) {
            log.error("Error calling admin-core service for faculty by package sessions", e);
            return new ArrayList<>(); // Return empty list on error
        }
    }

    /**
     * Get student user IDs by package sessions - with caching and retry
     */
    @Cacheable(value = "studentsByPackageSessions", key = "#packageSessionIds.hashCode()")
    @Retryable(value = {RestClientException.class}, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public List<String> getStudentsByPackageSessions(List<String> packageSessionIds) {
        log.debug("Calling admin-core service to get students for {} package sessions", packageSessionIds.size());
        
        if (packageSessionIds == null || packageSessionIds.isEmpty()) {
            return new ArrayList<>();
        }
        
        try {
            String url = adminCoreServiceBaseUrl + "/admin-core-service/v1/students/by-package-sessions";
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            Map<String, Object> requestBody = Map.of("packageSessionIds", packageSessionIds);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<List<String>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<List<String>>() {}
            );

            List<String> userIds = response.getBody();
            if (userIds == null) {
                userIds = new ArrayList<>();
            }
            
            log.debug("Found {} students across {} package sessions", userIds.size(), packageSessionIds.size());
            return userIds;
            
        } catch (Exception e) {
            log.error("Error calling admin-core service for students by package sessions", e);
            return new ArrayList<>(); // Return empty list on error
        }
    }

    /**
     * Get user IDs by tags for a given institute
     */
    @Cacheable(value = "usersByTags", key = "#instituteId + ':' + #tagIds.hashCode()")
    @Retryable(value = {RestClientException.class}, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public List<String> getUsersByTags(String instituteId, List<String> tagIds) {
        log.debug("Calling admin-core service to get users by {} tags for institute {}", tagIds != null ? tagIds.size() : 0, instituteId);

        if (instituteId == null || instituteId.isBlank() || tagIds == null || tagIds.isEmpty()) {
            return new ArrayList<>();
        }

        try {
            String url = adminCoreServiceBaseUrl + "/admin-core-service/v1/institutes/" + instituteId + "/tags/users";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<List<String>> entity = new HttpEntity<>(tagIds, headers);

            ResponseEntity<List<String>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<List<String>>() {}
            );

            List<String> userIds = response.getBody();
            if (userIds == null) {
                userIds = new ArrayList<>();
            }

            log.debug("Found {} users for {} tags in institute {}", userIds.size(), tagIds.size(), instituteId);
            return userIds;

        } catch (Exception e) {
            log.error("Error calling admin-core service for users by tags", e);
            return new ArrayList<>();
        }
    }
}