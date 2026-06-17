package vacademy.io.admin_core_service.features.user_resolution.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.user_resolution.dto.BatchSearchRequest;
import vacademy.io.admin_core_service.features.user_resolution.dto.FacultyPackageSessionsRequest;
import vacademy.io.admin_core_service.features.user_resolution.dto.PackageSessionsRequest;
import vacademy.io.admin_core_service.features.user_resolution.service.UserResolutionService;
import vacademy.io.admin_core_service.features.institute_learner.dto.CustomFieldFilterRequest;
import vacademy.io.admin_core_service.features.institute_learner.dto.PaginatedUserIdResponse;
import vacademy.io.admin_core_service.features.institute_learner.service.CustomFieldFilterService;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/v1")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*") // For internal service communication
public class UserResolutionController {

    private final UserResolutionService userResolutionService;
    private final CustomFieldFilterService customFieldFilterService;

    /**
     * Get faculty user IDs by package sessions
     * Used by notification service to resolve package session recipients (faculty)
     */
    @PostMapping("/faculty/by-package-sessions")
    public ResponseEntity<List<String>> getFacultyByPackageSessions(@Valid @RequestBody PackageSessionsRequest request) {
        try {
            log.info("Getting faculty for {} package sessions", request.getPackageSessionIds().size());
            List<String> userIds = userResolutionService.getFacultyUserIdsByPackageSessions(request.getPackageSessionIds());
            log.info("Found {} faculty members across {} package sessions", userIds.size(), request.getPackageSessionIds().size());
            return ResponseEntity.ok(userIds);
            
        } catch (Exception e) {
            log.error("Error getting faculty by package sessions", e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get student user IDs by package sessions
     * Used by notification service to resolve package session recipients (students)
     */
    @PostMapping("/students/by-package-sessions")
    public ResponseEntity<List<String>> getStudentsByPackageSessions(@Valid @RequestBody PackageSessionsRequest request) {
        try {
            log.info("Getting students for {} package sessions", request.getPackageSessionIds().size());
            List<String> userIds = userResolutionService.getStudentUserIdsByPackageSessions(request.getPackageSessionIds());
            log.info("Found {} students across {} package sessions", userIds.size(), request.getPackageSessionIds().size());
            return ResponseEntity.ok(userIds);
            
        } catch (Exception e) {
            log.error("Error getting students by package sessions", e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Resolve display names for package sessions (batches).
     * Used by notification service to title batch-group chats with the batch's real name.
     */
    @PostMapping("/package-sessions/names")
    public ResponseEntity<Map<String, String>> getBatchNamesByPackageSessions(
            @Valid @RequestBody PackageSessionsRequest request) {
        try {
            Map<String, String> names = userResolutionService
                    .getBatchNamesByPackageSessions(request.getPackageSessionIds());
            return ResponseEntity.ok(names);
        } catch (Exception e) {
            log.error("Error getting batch names by package sessions", e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Forward faculty mapping: package-session (batch) ids a faculty user is mapped to in an institute.
     * Used by notification service to scope a teacher's chat batch list/search to their batches.
     */
    @PostMapping("/faculty/package-sessions")
    public ResponseEntity<List<String>> getFacultyPackageSessions(@RequestBody FacultyPackageSessionsRequest request) {
        try {
            List<String> ids = userResolutionService.getFacultyPackageSessions(
                    request.getUserId(), request.getInstituteId());
            return ResponseEntity.ok(ids);
        } catch (Exception e) {
            log.error("Error getting faculty package sessions", e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Search an institute's batches by name -> [{packageSessionId, name}]. Optional packageSessionIds
     * scopes the search to a teacher's mapped batches. Powers the chat "start a new batch" picker.
     */
    @PostMapping("/package-sessions/search")
    public ResponseEntity<List<Map<String, String>>> searchBatches(@RequestBody BatchSearchRequest request) {
        try {
            List<Map<String, String>> batches = userResolutionService.searchBatches(
                    request.getInstituteId(), request.getNameQuery(),
                    request.getPackageSessionIds(), request.getLimit());
            return ResponseEntity.ok(batches);
        } catch (Exception e) {
            log.error("Error searching batches", e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get user IDs by custom field filters with pagination
     * Used by notification service to resolve custom field filter recipients
     */
    @PostMapping("/users/by-custom-field-filters")
    public ResponseEntity<PaginatedUserIdResponse> getUserIdsByCustomFieldFilters(
            @Valid @RequestBody CustomFieldFilterRequest request,
            @RequestParam(value = "pageNumber", defaultValue = "0", required = false) int pageNumber,
            @RequestParam(value = "pageSize", defaultValue = "1000", required = false) int pageSize) {
        
        log.info("✅ REQUEST RECEIVED: Getting user IDs by custom field filters for institute: {} with {} filters (page: {}, size: {})", 
                request != null ? request.getInstituteId() : "null", 
                request != null && request.getFilters() != null ? request.getFilters().size() : 0,
                pageNumber,
                pageSize);
        
        if (request.getFilters() != null && !request.getFilters().isEmpty()) {
            for (int i = 0; i < request.getFilters().size(); i++) {
                CustomFieldFilterRequest.CustomFieldFilter filter = request.getFilters().get(i);
                if (filter.getCustomFieldId() != null && !filter.getCustomFieldId().isBlank()) {
                    log.info("Filter {}: customFieldId='{}', fieldValue='{}', operator='{}'", 
                            i, 
                            filter.getCustomFieldId(), 
                            filter.getFieldValue(),
                            filter.getOperator() != null ? filter.getOperator() : "equals");
                } else {
                    log.info("Filter {}: fieldName='{}', fieldValue='{}', operator='{}'", 
                            i, 
                            filter.getFieldName(), 
                            filter.getFieldValue(),
                            filter.getOperator() != null ? filter.getOperator() : "equals");
                }
            }
        } else {
            log.warn("No filters provided in request!");
        }
        
        if (request.getStatuses() != null && !request.getStatuses().isEmpty()) {
            log.info("Status filter: {}", request.getStatuses());
        }
        
        try {
            PaginatedUserIdResponse response = customFieldFilterService.getUserIdsByCustomFieldFilters(
                    request.getInstituteId(),
                    request.getFilters(),
                    request.getStatuses(),
                    pageNumber,
                    pageSize
            );
            
            log.info("Returning {} user IDs (page {} of {}, total: {})", 
                    response.getUserIds() != null ? response.getUserIds().size() : 0,
                    pageNumber + 1,
                    response.getTotalPages(),
                    response.getTotalElements());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error getting user IDs by custom field filters for institute: {}", request.getInstituteId(), e);
            return ResponseEntity.badRequest().build();
        }
    }
}