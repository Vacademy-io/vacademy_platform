package vacademy.io.auth_service.feature.auth.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
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
}
