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

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminCoreServiceClient {

    private final RestTemplate restTemplate;
    private final InternalClientUtils internalClientUtils;

    @Value("${admin.core.service.baseurl:http://admin-core-service.vacademy.svc.cluster.local:8072}")
    private String adminCoreServiceBaseUrl;

    @Value("${spring.application.name:notification_service}")
    private String clientName;

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
            // For scalability, fetch paginated results for each package session
            Set<String> allUserIds = new HashSet<>();
            int pageSize = 1000; // Fetch 1000 users at a time

            for (String packageSessionId : packageSessionIds) {
                boolean hasMore = true;
                int pageNumber = 0;

                while (hasMore) {
                    String url = adminCoreServiceBaseUrl + "/admin-core-service/v1/students/by-package-session" +
                            "?packageSessionId=" + packageSessionId +
                            "&pageNumber=" + pageNumber +
                            "&pageSize=" + pageSize;

                    HttpHeaders headers = new HttpHeaders();
                    headers.setContentType(MediaType.APPLICATION_JSON);
                    HttpEntity<String> entity = new HttpEntity<>(headers);

                    ResponseEntity<List<String>> response = restTemplate.exchange(
                            url,
                            HttpMethod.GET,
                            entity,
                            new ParameterizedTypeReference<List<String>>() {}
                    );

                    List<String> userIds = response.getBody();
                    if (userIds != null && !userIds.isEmpty()) {
                        allUserIds.addAll(userIds);
                        log.debug("Fetched page {}: {} students for package session {}", pageNumber, userIds.size(), packageSessionId);

                        // If we got a full page, there might be more
                        hasMore = userIds.size() == pageSize;
                    } else {
                        hasMore = false;
                    }

                    pageNumber++;
                }
            }

            List<String> result = new ArrayList<>(allUserIds);
            log.debug("Found {} unique students across {} package sessions", result.size(), packageSessionIds.size());
            return result;

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

    /**
     * Get user IDs by package session and org roles with pagination
     * Used by notification service to resolve PACKAGE_SESSION_COMMA_SEPARATED_ORG_ROLES recipients
     */
    @Retryable(value = {RestClientException.class}, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public List<String> getUsersByPackageSessionAndOrgRoles(String packageSessionId, String commaSeparatedOrgRoles) {
        log.debug("Calling admin-core service to get users by package session and org roles: packageSessionId={}, orgRoles={}",
                packageSessionId, commaSeparatedOrgRoles);

        if (packageSessionId == null || packageSessionId.isBlank() ||
            commaSeparatedOrgRoles == null || commaSeparatedOrgRoles.isBlank()) {
            return new ArrayList<>();
        }

        try {
            // For scalability, fetch paginated results
            Set<String> allUserIds = new HashSet<>();
            int pageSize = 1000; // Fetch 1000 users at a time
            boolean hasMore = true;
            int pageNumber = 0;

            while (hasMore) {
                String url = adminCoreServiceBaseUrl + "/admin-core-service/v1/users/by-package-session-org-roles" +
                        "?packageSessionId=" + packageSessionId +
                        "&commaSeparatedOrgRoles=" + commaSeparatedOrgRoles +
                        "&pageNumber=" + pageNumber +
                        "&pageSize=" + pageSize;

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                HttpEntity<String> entity = new HttpEntity<>(headers);

                ResponseEntity<List<String>> response = restTemplate.exchange(
                        url,
                        HttpMethod.GET,
                        entity,
                        new ParameterizedTypeReference<List<String>>() {}
                );

                List<String> userIds = response.getBody();
                if (userIds != null && !userIds.isEmpty()) {
                    allUserIds.addAll(userIds);
                    log.debug("Fetched page {}: {} users for package session {} with org roles {}",
                            pageNumber, userIds.size(), packageSessionId, commaSeparatedOrgRoles);

                    // If we got a full page, there might be more
                    hasMore = userIds.size() == pageSize;
                } else {
                    hasMore = false;
                }

                pageNumber++;
            }

            List<String> result = new ArrayList<>(allUserIds);
            log.debug("Found {} unique users for package session {} with org roles {}",
                    result.size(), packageSessionId, commaSeparatedOrgRoles);
            return result;

        } catch (Exception e) {
            log.error("Error calling admin-core service for users by package session and org roles", e);
            return new ArrayList<>();
        }
    }

    /**
     * Get converted user IDs for a campaign/audience
     * Used to resolve AUDIENCE recipient type in announcements
     *
     * @param audienceId Campaign/audience ID
     * @param instituteId Institute ID for security validation
     * @return List of user IDs who were converted from this campaign
     */
    @Retryable(value = {RestClientException.class}, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public List<String> getConvertedUsersByCampaign(String audienceId, String instituteId) {
        log.debug("Calling admin-core service to get converted users for campaign: {} (institute: {})",
                audienceId, instituteId);

        if (audienceId == null || audienceId.isBlank() || instituteId == null || instituteId.isBlank()) {
            log.warn("Campaign ID or Institute ID is missing");
            return new ArrayList<>();
        }

        try {
            // For scalability, fetch paginated results
            Set<String> allUserIds = new HashSet<>();
            int pageSize = 1000; // Fetch 1000 users at a time
            boolean hasMore = true;
            int pageNumber = 0;

            while (hasMore) {
                String route = "/admin-core-service/internal/campaign/" + instituteId + "/" + audienceId + "/users/paginated" +
                        "?pageNumber=" + pageNumber + "&pageSize=" + pageSize;

                log.debug("Calling INTERNAL URL: {}{}", adminCoreServiceBaseUrl, route);

                // Use InternalClientUtils to automatically add clientName and Signature headers
                ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                        clientName,
                        HttpMethod.GET.name(),
                        adminCoreServiceBaseUrl,
                        route,
                        null
                );

                // Parse JSON body to List<String>
                List<String> userIds;
                String body = response.getBody();
                if (body == null || body.isBlank()) {
                    userIds = new ArrayList<>();
                } else {
                    ObjectMapper mapper = new ObjectMapper();
                    userIds = mapper.readValue(body, new TypeReference<List<String>>() {});
                }

                if (userIds != null && !userIds.isEmpty()) {
                    allUserIds.addAll(userIds);
                    log.debug("Fetched page {}: {} converted users for campaign {}", pageNumber, userIds.size(), audienceId);

                    // If we got a full page, there might be more
                    hasMore = userIds.size() == pageSize;
                } else {
                    hasMore = false;
                }

                pageNumber++;
            }

            List<String> result = new ArrayList<>(allUserIds);
            log.info("Found {} total converted users for campaign {} (institute: {})",
                    result.size(), audienceId, instituteId);
            return result;

        } catch (Exception e) {
            log.error("Error calling admin-core service for converted users by campaign {} (institute: {})",
                    audienceId, instituteId, e);
            return new ArrayList<>();
        }
    }

    /**
     * Centralized recipient resolution API - handles inclusions, exclusions, and custom field filters in one call
     */
    @Retryable(value = {RestClientException.class}, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public vacademy.io.notification_service.features.announcements.dto.PaginatedUserIdResponse resolveRecipientsCentralized(
            vacademy.io.notification_service.features.announcements.dto.CentralizedRecipientResolutionRequest request) {

        log.debug("Calling centralized recipient resolution API for institute: {} with {} recipients",
                request.getInstituteId(), request.getRecipients().size());

        if (request.getInstituteId() == null || request.getInstituteId().isBlank() ||
            request.getRecipients() == null || request.getRecipients().isEmpty()) {
            return new vacademy.io.notification_service.features.announcements.dto.PaginatedUserIdResponse(
                new ArrayList<>(), 0, 1000, 0, 0, false, false, true, true);
        }

        try {
            String url = adminCoreServiceBaseUrl + "/admin-core-service/v1/recipient-resolution/centralized";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<vacademy.io.notification_service.features.announcements.dto.CentralizedRecipientResolutionRequest> entity =
                new HttpEntity<>(request, headers);

            ResponseEntity<vacademy.io.notification_service.features.announcements.dto.PaginatedUserIdResponse> response =
                restTemplate.exchange(url, HttpMethod.POST, entity,
                    new ParameterizedTypeReference<vacademy.io.notification_service.features.announcements.dto.PaginatedUserIdResponse>() {});

            vacademy.io.notification_service.features.announcements.dto.PaginatedUserIdResponse result = response.getBody();
            if (result == null) {
                return new vacademy.io.notification_service.features.announcements.dto.PaginatedUserIdResponse(
                    new ArrayList<>(), request.getPageNumber(), request.getPageSize(), 0, 0, false, false, true, true);
            }

            log.debug("Centralized resolution returned {} users (page {}/{}, total: {})",
                    result.getUserIds().size(), result.getPageNumber() + 1, result.getTotalPages(), result.getTotalElements());

            return result;

        } catch (Exception e) {
            log.error("Error calling centralized recipient resolution API for institute: {}", request.getInstituteId(), e);
            return new vacademy.io.notification_service.features.announcements.dto.PaginatedUserIdResponse(
                new ArrayList<>(), request.getPageNumber(), request.getPageSize(), 0, 0, false, false, true, true);
        }
    }
}