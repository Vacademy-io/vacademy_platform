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
            // Return a shallow copy to avoid cyclic serialization issues
            List<User> sanitized = users.stream().map(this::shallowUser).toList();
            log.info("Found {} users with role: {} in institute: {}", sanitized.size(), roleName, instituteId);
            return ResponseEntity.ok(sanitized);
            
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
            List<User> sanitized = users.stream().map(this::shallowUser).toList();
            log.info("Found {} users out of {} requested IDs", sanitized.size(), request.getUserIds().size());
            return ResponseEntity.ok(sanitized);
            
        } catch (Exception e) {
            log.error("Error getting users by IDs", e);
            return ResponseEntity.badRequest().build();
        }
    }

    private User shallowUser(User u) {
        if (u == null) return null;
        User v = new User();
        try {
            v.setId(u.getId());
            v.setEmail(u.getEmail());
            v.setMobileNumber(u.getMobileNumber());
            v.setFullName(u.getFullName());
        } catch (Exception ignore) { }
        return v;
    }
}