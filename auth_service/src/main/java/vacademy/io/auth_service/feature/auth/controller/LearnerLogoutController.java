package vacademy.io.auth_service.feature.auth.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.user.service.UserSessionService;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.service.JwtService;
import vacademy.io.common.auth.service.RefreshTokenService;
import vacademy.io.common.exceptions.VacademyException;

/**
 * Full logout endpoint for learners.
 *
 * POST /auth-service/learner/v1/logout
 * Header: Authorization: Bearer <access_token>
 *
 * This:
 * 1. Deletes the user's refresh token (prevents token refresh after logout)
 * 2. Marks the current session as inactive in user_session table
 *
 * This endpoint did not previously exist — it's new.
 */
@RestController
@RequestMapping("/auth-service/learner/v1")
public class LearnerLogoutController {

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private UserSessionService userSessionService;

    @PostMapping("/logout")
    public ResponseEntity<String> logout(HttpServletRequest request) {

        // 1. Extract JWT from Authorization header
        String token = extractBearerToken(request);
        if (!StringUtils.hasText(token)) {
            throw new VacademyException("Authorization token is missing or invalid");
        }

        // 2. Extract username from JWT (jwtService.extractUsername uses JWT
        // Claims.getSubject)
        String username;
        try {
            username = jwtService.extractUsername(token);
        } catch (Exception e) {
            throw new VacademyException("Invalid or expired token");
        }

        if (!StringUtils.hasText(username)) {
            throw new VacademyException("Could not identify user from token");
        }

        // 3. Find user
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new VacademyException("User not found"));

        // 4. Delete refresh token — prevents minting new access tokens
        refreshTokenService.deleteAllRefreshToken(user);

        // 5. Mark the session as inactive using the raw JWT as session_token
        // (The full JWT is stored in user_session.session_token at login time)
        userSessionService.terminateSessionByToken(token);

        return ResponseEntity.ok("Logged out successfully");
    }

    private String extractBearerToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }
}
