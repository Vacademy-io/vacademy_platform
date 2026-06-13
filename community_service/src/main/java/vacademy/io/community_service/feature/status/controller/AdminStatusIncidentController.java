package vacademy.io.community_service.feature.status.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.status.dto.AddIncidentUpdateRequest;
import vacademy.io.community_service.feature.status.dto.CreateIncidentRequest;
import vacademy.io.community_service.feature.status.dto.StatusIncidentDto;
import vacademy.io.community_service.feature.status.dto.UpdateIncidentRequest;
import vacademy.io.community_service.feature.status.service.StatusIncidentService;

import java.util.List;

/**
 * Admin management of status-page incidents. Restricted to users carrying the
 * "ADMIN" authority. The request is already authenticated by the JWT filter
 * (these paths are not in the security ALLOWED_PATHS allow-list).
 */
@RestController
@RequestMapping("/community-service/admin/v1/status")
public class AdminStatusIncidentController {

    private static final String ADMIN_AUTHORITY = "ADMIN";

    @Autowired
    private StatusIncidentService statusIncidentService;

    @GetMapping("/incidents")
    public ResponseEntity<List<StatusIncidentDto>> getIncidents(@RequestAttribute("user") CustomUserDetails user) {
        requireAdmin(user);
        return ResponseEntity.ok(statusIncidentService.listIncidents());
    }

    @PostMapping("/incidents")
    public ResponseEntity<StatusIncidentDto> createIncident(@RequestAttribute("user") CustomUserDetails user,
            @RequestBody CreateIncidentRequest request) {
        requireAdmin(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(statusIncidentService.createIncident(user, request));
    }

    @PatchMapping("/incidents/{id}")
    public ResponseEntity<StatusIncidentDto> updateIncident(@RequestAttribute("user") CustomUserDetails user,
            @PathVariable String id, @RequestBody UpdateIncidentRequest request) {
        requireAdmin(user);
        return ResponseEntity.ok(statusIncidentService.updateIncident(id, request));
    }

    @PostMapping("/incidents/{id}/updates")
    public ResponseEntity<StatusIncidentDto> addIncidentUpdate(@RequestAttribute("user") CustomUserDetails user,
            @PathVariable String id, @RequestBody AddIncidentUpdateRequest request) {
        requireAdmin(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(statusIncidentService.addUpdate(id, user, request));
    }

    @DeleteMapping("/incidents/{id}")
    public ResponseEntity<Void> deleteIncident(@RequestAttribute("user") CustomUserDetails user,
            @PathVariable String id) {
        requireAdmin(user);
        statusIncidentService.deleteIncident(id);
        return ResponseEntity.noContent().build();
    }

    private void requireAdmin(CustomUserDetails user) {
        if (user == null || user.getAuthorities() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        boolean isAdmin = user.getAuthorities().stream()
                .anyMatch(authority -> ADMIN_AUTHORITY.equalsIgnoreCase(authority.getAuthority()));
        if (!isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ADMIN role required");
        }
    }
}
