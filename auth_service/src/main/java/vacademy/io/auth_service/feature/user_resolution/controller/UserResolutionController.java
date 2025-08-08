package vacademy.io.auth_service.feature.user_resolution.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.user_resolution.dto.UsersByIdsRequest;
import vacademy.io.auth_service.feature.user_resolution.service.UserResolutionService;
import vacademy.io.common.auth.entity.User;

import jakarta.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/auth-service/v1/users")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*") // For internal service communication
public class UserResolutionController {

    private final UserResolutionService userResolutionService;

    /**
     * Get users by role for a specific institute
     * Used by notification service to resolve role-based recipients
     */
    @GetMapping("/by-role")
    public ResponseEntity<List<User>> getUsersByRole(
            @RequestParam String instituteId,
            @RequestParam String roleName) {
        
        try {
            log.info("Getting users by role: {} for institute: {}", roleName, instituteId);
            List<User> users = userResolutionService.getUsersByInstituteAndRole(instituteId, roleName);
            log.info("Found {} users with role: {} in institute: {}", users.size(), roleName, instituteId);
            return ResponseEntity.ok(users);
            
        } catch (Exception e) {
            log.error("Error getting users by role: {} for institute: {}", roleName, instituteId, e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get users by list of user IDs (for getting contact information)
     * Used by notification service to get email/phone details for delivery
     */
    @PostMapping("/by-ids")
    public ResponseEntity<List<User>> getUsersByIds(@Valid @RequestBody UsersByIdsRequest request) {
        try {
            log.info("Getting {} users by IDs", request.getUserIds().size());
            List<User> users = userResolutionService.getUsersByIds(request.getUserIds());
            log.info("Found {} users out of {} requested IDs", users.size(), request.getUserIds().size());
            return ResponseEntity.ok(users);
            
        } catch (Exception e) {
            log.error("Error getting users by IDs", e);
            return ResponseEntity.badRequest().build();
        }
    }
}