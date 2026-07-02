package vacademy.io.admin_core_service.features.live_session.provider.controller.google;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.live_session.provider.dto.google.GoogleAccountSettingsRequest;
import vacademy.io.admin_core_service.features.live_session.provider.dto.google.GoogleAccountSummary;
import vacademy.io.admin_core_service.features.live_session.provider.dto.google.GoogleTestConnectionResponse;
import vacademy.io.admin_core_service.features.live_session.provider.service.google.GoogleAccountService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;

/**
 * REST API for managing per-institute connected Google Workspace accounts.
 *
 * Accounts are created via the OAuth "Connect Google Workspace" flow
 * ({@code GoogleOAuthController}), so there is no POST/create here — only list, read,
 * settings update, set-default, disconnect, and test-connection.
 *
 * Cross-tenant safety: every endpoint takes {@code instituteId} and validates the
 * authenticated principal via {@link InstituteAccessValidator}; mutations require an
 * admin role. Mirrors {@code ZoomAccountController}.
 */
@RestController
@RequestMapping("/admin-core-service/live-sessions/provider/google/accounts")
@RequiredArgsConstructor
public class GoogleMeetAccountController {

    private static final List<String> ADMIN_ROLES = List.of("ADMIN", "INSTITUTE_ADMIN");

    private final GoogleAccountService service;
    private final InstituteAccessValidator instituteAccessValidator;

    @GetMapping
    public ResponseEntity<List<GoogleAccountSummary>> list(
            @RequestAttribute(name = "user") CustomUserDetails user,
            @RequestParam String instituteId) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(service.list(instituteId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<GoogleAccountSummary> getOne(
            @RequestAttribute(name = "user") CustomUserDetails user,
            @RequestParam String instituteId,
            @PathVariable String id) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(service.getOne(instituteId, id));
    }

    @PutMapping("/{id}/settings")
    public ResponseEntity<GoogleAccountSummary> updateSettings(
            @RequestAttribute(name = "user") CustomUserDetails user,
            @RequestParam String instituteId,
            @PathVariable String id,
            @Valid @RequestBody GoogleAccountSettingsRequest req) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        requireAdminRole(user);
        return ResponseEntity.ok(service.updateSettings(instituteId, id, req));
    }

    @PostMapping("/{id}/set-default")
    public ResponseEntity<GoogleAccountSummary> setDefault(
            @RequestAttribute(name = "user") CustomUserDetails user,
            @RequestParam String instituteId,
            @PathVariable String id) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        requireAdminRole(user);
        return ResponseEntity.ok(service.setDefault(instituteId, id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> disconnect(
            @RequestAttribute(name = "user") CustomUserDetails user,
            @RequestParam String instituteId,
            @PathVariable String id) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        requireAdminRole(user);
        service.disconnect(instituteId, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/test-connection")
    public ResponseEntity<GoogleTestConnectionResponse> testConnection(
            @RequestAttribute(name = "user") CustomUserDetails user,
            @RequestParam String instituteId,
            @PathVariable String id) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        requireAdminRole(user);
        return ResponseEntity.ok(service.testConnection(instituteId, id));
    }

    private void requireAdminRole(CustomUserDetails user) {
        if (user.isRootUser()) return;
        boolean hasAdmin = user.getAuthorities() != null && user.getAuthorities().stream()
                .map(a -> a.getAuthority().toUpperCase())
                .anyMatch(ADMIN_ROLES::contains);
        if (!hasAdmin) {
            throw new VacademyException(HttpStatus.FORBIDDEN,
                    "Admin role required to manage Google Workspace integration");
        }
    }
}
