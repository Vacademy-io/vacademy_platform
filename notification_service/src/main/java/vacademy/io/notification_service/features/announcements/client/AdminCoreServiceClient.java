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
import java.util.HashMap;
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
    @Retryable(value = {RestClientException.class}, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public List<String> getUsersByTags(String instituteId, List<String> tagIds) {
        log.debug("Calling admin-core service to get users by {} tags for institute {}", tagIds != null ? tagIds.size() : 0, instituteId);

        if (instituteId == null || instituteId.isBlank() || tagIds == null || tagIds.isEmpty()) {
            return new ArrayList<>();
        }

        try {
            String url = adminCoreServiceBaseUrl + "/admin-core-service/tag-management/institutes/" + instituteId + "/tags/users";

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

    /**
     * Get user IDs by custom field filters with pagination
     * This method handles pagination internally to fetch all matching users
     * Scalable for large datasets (0.15M+ users)
     */
    @Retryable(value = {RestClientException.class}, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public List<String> getUsersByCustomFieldFilters(
            String instituteId,
            List<vacademy.io.notification_service.features.announcements.dto.CreateAnnouncementRequest.RecipientRequest.CustomFieldFilter> filters,
            List<String> statuses) {
        
        log.debug("Calling admin-core service to get users by custom field filters for institute {} with {} filters", 
                instituteId, filters != null ? filters.size() : 0);

        if (instituteId == null || instituteId.isBlank() || filters == null || filters.isEmpty()) {
            return new ArrayList<>();
        }

        try {
            // Convert filters to admin-core-service format
            List<Map<String, Object>> filterList = new ArrayList<>();
            for (vacademy.io.notification_service.features.announcements.dto.CreateAnnouncementRequest.RecipientRequest.CustomFieldFilter filter : filters) {
                Map<String, Object> filterMap = new HashMap<>();
                
                // Prefer customFieldId over fieldName
                if (filter.getCustomFieldId() != null && !filter.getCustomFieldId().isBlank()) {
                    filterMap.put("customFieldId", filter.getCustomFieldId());
                    log.debug("Converted filter: customFieldId={}, fieldValue={}, operator={}", 
                            filter.getCustomFieldId(), filter.getFieldValue(), 
                            filter.getOperator() != null ? filter.getOperator() : "equals");
                } else if (filter.getFieldName() != null && !filter.getFieldName().isBlank()) {
                    filterMap.put("fieldName", filter.getFieldName());
                    log.debug("Converted filter: fieldName={}, fieldValue={}, operator={}", 
                            filter.getFieldName(), filter.getFieldValue(), 
                            filter.getOperator() != null ? filter.getOperator() : "equals");
                } else {
                    log.warn("Filter missing both customFieldId and fieldName, skipping");
                    continue;
                }
                
                filterMap.put("fieldValue", filter.getFieldValue());
                filterMap.put("operator", filter.getOperator() != null ? filter.getOperator() : "equals");
                filterList.add(filterMap);
            }

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("instituteId", instituteId);
            requestBody.put("filters", filterList);
            if (statuses != null && !statuses.isEmpty()) {
                requestBody.put("statuses", statuses);
            }
            
            log.debug("Sending request to admin-core-service with {} filters for institute {}", 
                    filterList.size(), instituteId);

            List<String> allUserIds = new ArrayList<>();
            int pageNumber = 0;
            int pageSize = 1000; // Fetch 1000 users at a time
            boolean hasMore = true;

            while (hasMore) {
                String url = adminCoreServiceBaseUrl + "/admin-core-service/v1/users/by-custom-field-filters" +
                        "?pageNumber=" + pageNumber + "&pageSize=" + pageSize;

                log.debug("Calling admin-core-service at URL: {} (baseUrl: {})", url, adminCoreServiceBaseUrl);

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

                ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                        url,
                        HttpMethod.POST,
                        entity,
                        new ParameterizedTypeReference<Map<String, Object>>() {}
                );

                Map<String, Object> responseBody = response.getBody();
                if (responseBody != null) {
                    @SuppressWarnings("unchecked")
                    List<String> userIds = (List<String>) responseBody.get("userIds");
                    if (userIds != null) {
                        allUserIds.addAll(userIds);
                    }
                    
                    Boolean hasNext = (Boolean) responseBody.get("hasNext");
                    hasMore = hasNext != null && hasNext;
                    
                    log.debug("Fetched page {}: {} users (total so far: {})", pageNumber, userIds != null ? userIds.size() : 0, allUserIds.size());
                } else {
                    hasMore = false;
                }
                
                pageNumber++;
                
                // Safety check to prevent infinite loops
                if (pageNumber > 1000) {
                    log.warn("Reached maximum page limit (1000) while fetching users by custom field filters");
                    break;
                }
            }

            log.debug("Found {} total users for institute {} with custom field filters", allUserIds.size(), instituteId);
            return allUserIds;

        } catch (Exception e) {
            // Log connection/auth errors at WARN level, other errors at ERROR
            if (e.getMessage() != null && (e.getMessage().contains("403") || e.getMessage().contains("Forbidden") || e.getMessage().contains("Connection refused"))) {
                log.warn("Cannot connect to admin-core-service at {}: {}. If running locally, ensure admin-core-service is running on port 8072.", 
                        adminCoreServiceBaseUrl, e.getMessage());
            } else {
                log.error("Error calling admin-core service for users by custom field filters", e);
            }
            return new ArrayList<>();
        }
    }
}