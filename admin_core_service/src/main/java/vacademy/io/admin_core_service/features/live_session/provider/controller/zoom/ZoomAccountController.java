package vacademy.io.admin_core_service.features.live_session.provider.controller.zoom;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.live_session.provider.dto.zoom.ZoomAccountRequest;
import vacademy.io.admin_core_service.features.live_session.provider.dto.zoom.ZoomAccountSummary;
import vacademy.io.admin_core_service.features.live_session.provider.dto.zoom.ZoomTestConnectionResponse;
import vacademy.io.admin_core_service.features.live_session.provider.service.zoom.ZoomAccountService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;

/**
 * REST API for managing per-institute Zoom integration accounts.
 *
 * Cross-tenant safety: every endpoint takes {@code instituteId} as a query parameter
 * and validates the authenticated principal has a role in that institute via
 * {@link InstituteAccessValidator}. Mutation endpoints additionally require an
 * INSTITUTE_ADMIN role (sub-org admins read-only in v1).
 */
@RestController
@RequestMapping("/admin-core-service/live-sessions/provider/zoom/accounts")
@RequiredArgsConstructor
public class ZoomAccountController {

    /** Role names that may modify Zoom account credentials. */
    private static final List<String> ADMIN_ROLES = List.of("ADMIN", "INSTITUTE_ADMIN");

    private final ZoomAccountService service;
    private final InstituteAccessValidator instituteAccessValidator;

    @GetMapping
    public ResponseEntity<List<ZoomAccountSummary>> list(
            @RequestAttribute(name = "user") CustomUserDetails user,
            @RequestParam String instituteId) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(service.list(instituteId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ZoomAccountSummary> getOne(
            @RequestAttribute(name = "user") CustomUserDetails user,
            @RequestParam String instituteId,
            @PathVariable String id) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(service.getOne(instituteId, id));
    }

    @PostMapping
    public ResponseEntity<ZoomAccountSummary> create(
            @RequestAttribute(name = "user") CustomUserDetails user,
            @RequestParam String instituteId,
            @Valid @RequestBody ZoomAccountRequest req) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        requireAdminRole(user, instituteId);
        return ResponseEntity.ok(service.create(instituteId, req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ZoomAccountSummary> update(
            @RequestAttribute(name = "user") CustomUserDetails user,
            @RequestParam String instituteId,
            @PathVariable String id,
            @Valid @RequestBody ZoomAccountRequest req) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        requireAdminRole(user, instituteId);
        return ResponseEntity.ok(service.update(instituteId, id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestAttribute(name = "user") CustomUserDetails user,
            @RequestParam String instituteId,
            @PathVariable String id) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        requireAdminRole(user, instituteId);
        service.delete(instituteId, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/set-default")
    public ResponseEntity<ZoomAccountSummary> setDefault(
            @RequestAttribute(name = "user") CustomUserDetails user,
            @RequestParam String instituteId,
            @PathVariable String id) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        requireAdminRole(user, instituteId);
        return ResponseEntity.ok(service.setDefault(instituteId, id));
    }

    @PostMapping("/{id}/test-connection")
    public ResponseEntity<ZoomTestConnectionResponse> testConnection(
            @RequestAttribute(name = "user") CustomUserDetails user,
            @RequestParam String instituteId,
            @PathVariable String id) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        requireAdminRole(user, instituteId);
        return ResponseEntity.ok(service.testConnection(instituteId, id));
    }

    // ── Role check ──────────────────────────────────────────────────────────

    private void requireAdminRole(CustomUserDetails user, String instituteId) {
        if (user.isRootUser()) return;
        boolean hasAdmin = user.getAuthorities() != null && user.getAuthorities().stream()
                .map(a -> a.getAuthority().toUpperCase())
                .anyMatch(ADMIN_ROLES::contains);
        if (!hasAdmin) {
            throw new VacademyException(HttpStatus.FORBIDDEN,
                    "Admin role required to manage Zoom integration");
        }
    }
}
