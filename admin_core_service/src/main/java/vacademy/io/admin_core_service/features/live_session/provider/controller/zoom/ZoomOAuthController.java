package vacademy.io.admin_core_service.features.live_session.provider.controller.zoom;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.audience.entity.OAuthConnectState;
import vacademy.io.admin_core_service.features.audience.repository.OAuthConnectStateRepository;
import vacademy.io.admin_core_service.features.live_session.provider.service.zoom.ZoomOAuthService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.net.URI;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;

/**
 * "Connect with Zoom" onboarding (authorization-code OAuth).
 *
 *   POST /initiate  → admin-authed; returns the Zoom consent URL + a CSRF state key.
 *   GET  /callback  → PUBLIC (browser redirect from Zoom, no JWT); exchanges the code,
 *                     creates an OAUTH ZoomAccount, then bounces back to the admin UI.
 *
 * The /callback path MUST be in ApplicationSecurityConfig's permitAll list.
 */
@RestController
@RequestMapping("/admin-core-service/live-sessions/provider/zoom/oauth")
@RequiredArgsConstructor
@Slf4j
public class ZoomOAuthController {

    private static final String VENDOR = "ZOOM_OAUTH";
    private static final Set<String> ADMIN_ROLES = Set.of("ADMIN", "INSTITUTE_ADMIN");

    private final ZoomOAuthService zoomOAuthService;
    private final OAuthConnectStateRepository stateRepository;
    private final InstituteAccessValidator instituteAccessValidator;

    @Value("${zoom.oauth.frontend.callback.url:https://admin.vacademy.io/settings}")
    private String frontendCallbackUrl;

    /** Step 1 — return the Zoom consent URL the admin's browser should open. */
    @PostMapping("/initiate")
    public ResponseEntity<Map<String, String>> initiate(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam String instituteId) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        requireAdminRole(user);

        OAuthConnectState state = stateRepository.save(OAuthConnectState.builder()
                .instituteId(instituteId)
                .vendor(VENDOR)
                .initiatedBy(user.getUserId())
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .build());

        return ResponseEntity.ok(Map.of(
                "oauth_url", zoomOAuthService.buildAuthorizeUrl(state.getId()),
                "session_key", state.getId()));
    }

    /** Step 2 — Zoom redirects the browser here (PUBLIC). All token work is server-side. */
    @GetMapping("/callback")
    public ResponseEntity<Void> callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {
        if (error != null) return redirect("zoom_error=" + error);
        if (state == null || code == null) return redirect("zoom_error=missing_params");

        OAuthConnectState st = stateRepository.findValidById(state, LocalDateTime.now()).orElse(null);
        if (st == null || !VENDOR.equals(st.getVendor())) {
            return redirect("zoom_error=invalid_state");
        }
        try {
            zoomOAuthService.completeConnection(code, st.getInstituteId());
            st.setSessionStatus("AUTHORIZED");
            stateRepository.save(st);
            return redirect("zoom_connected=1");
        } catch (Exception e) {
            log.error("zoom.oauth.callback.fail state={} reason={}", state, e.getMessage());
            return redirect("zoom_error=connect_failed");
        }
    }

    private ResponseEntity<Void> redirect(String query) {
        String sep = frontendCallbackUrl.contains("?") ? "&" : "?";
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(frontendCallbackUrl + sep + query))
                .build();
    }

    private void requireAdminRole(CustomUserDetails user) {
        if (user.isRootUser()) return;
        boolean hasAdmin = user.getAuthorities() != null && user.getAuthorities().stream()
                .map(a -> a.getAuthority().toUpperCase())
                .anyMatch(ADMIN_ROLES::contains);
        if (!hasAdmin) {
            throw new VacademyException(HttpStatus.FORBIDDEN, "Admin role required to connect Zoom");
        }
    }
}
