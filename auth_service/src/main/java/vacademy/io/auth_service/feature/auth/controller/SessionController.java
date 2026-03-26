package vacademy.io.auth_service.feature.auth.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.auth.dto.ActiveSessionDTO;
import vacademy.io.auth_service.feature.user.service.UserSessionService;

import java.util.List;

/**
 * Handles popup-level session management for the multi-device restriction
 * feature.
 *
 * Two endpoints:
 * GET /auth-service/learner/v1/session/active — list active sessions for the
 * popup
 * POST /auth-service/learner/v1/session/logout — kill ONE session from the
 * popup
 *
 * These are public endpoints (no JWT required) since the user isn't logged in
 * yet
 * when the popup is shown. Security is by design: sessionId is a UUID — not
 * guessable.
 */
@RestController
@RequestMapping("/auth-service/learner/v1/session")
public class SessionController {

    @Autowired
    private UserSessionService userSessionService;

    /**
     * Returns all currently active sessions for a user.
     * Called by the frontend to populate the session-limit popup.
     *
     * GET /auth-service/learner/v1/session/active?userId={}&instituteId={}
     */
    @GetMapping("/active")
    public ResponseEntity<List<ActiveSessionDTO>> getActiveSessions(
            @RequestParam String userId,
            @RequestParam(required = false) String instituteId) {
        return ResponseEntity.ok(userSessionService.getActiveSessions(userId, instituteId));
    }

    /**
     * Terminates ONE specific session by its UUID.
     * Called when the user clicks "Log Out" on one of the session cards in the
     * popup.
     *
     * After calling this, the frontend should immediately re-call the login API —
     * the slot is now free.
     *
     * POST /auth-service/learner/v1/session/logout?sessionId={uuid}
     */
    @PostMapping("/logout")
    public ResponseEntity<String> logoutSession(@RequestParam String sessionId) {
        userSessionService.terminateSession(sessionId);
        return ResponseEntity.ok("Session terminated. Please log in again.");
    }

    /**
     * Terminates the CURRENT session using the JWT from Authorization header.
     * Called by the normal learner logout flow.
     *
     * POST /auth-service/learner/v1/session/logout-current
     * Header: Authorization: Bearer <access_token>
     */
    @PostMapping("/logout-current")
    public ResponseEntity<String> logoutCurrentSession(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            userSessionService.terminateSessionByToken(token);
        }
        return ResponseEntity.ok("Session terminated.");
    }

    /**
     * Called when a multi-institute user selects their institute.
     * Checks session limit and creates the session if under limit.
     *
     * POST /auth-service/learner/v1/session/select-institute
     * Body: { "user_id": "...", "institute_id": "...", "access_token": "...", "device_type": "WEB" }
     *
     * Returns 200 with { "session_limit_exceeded": false } if OK,
     * or { "session_limit_exceeded": true, "active_sessions": [...] } if blocked.
     */
    @PostMapping("/select-institute")
    public ResponseEntity<java.util.Map<String, Object>> selectInstitute(
            @RequestBody java.util.Map<String, String> body) {
        String userId = body.get("user_id");
        String instituteId = body.get("institute_id");
        String accessToken = body.get("access_token");
        String deviceType = body.getOrDefault("device_type", "WEB");

        java.util.Optional<java.util.List<ActiveSessionDTO>> sessionCheck =
                userSessionService.checkSessionLimit(userId, instituteId);

        if (sessionCheck.isPresent()) {
            return ResponseEntity.ok(java.util.Map.of(
                    "session_limit_exceeded", true,
                    "active_sessions", sessionCheck.get()));
        }

        // Under limit — create the session
        userSessionService.createSession(userId, instituteId, accessToken, deviceType);
        return ResponseEntity.ok(java.util.Map.of("session_limit_exceeded", false));
    }
}
