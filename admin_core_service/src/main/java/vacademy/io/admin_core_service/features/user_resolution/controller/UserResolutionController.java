package vacademy.io.admin_core_service.features.user_resolution.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.user_resolution.dto.PackageSessionsRequest;
import vacademy.io.admin_core_service.features.user_resolution.service.UserResolutionService;

import jakarta.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*") // For internal service communication
public class UserResolutionController {

    private final UserResolutionService userResolutionService;

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
}