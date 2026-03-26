package vacademy.io.auth_service.feature.user.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.auth_service.feature.auth.dto.ActiveSessionDTO;
import vacademy.io.auth_service.feature.institute.service.InstituteSettingsService;
import vacademy.io.common.auth.entity.UserSession;
import vacademy.io.common.auth.repository.UserSessionRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Manages learner session lifecycle:
 * - Session limit check before login (backward compatible — 0 = unlimited)
 * - Session creation after successful login
 * - Session termination by session ID (popup) or by token (logout)
 */
@Service
public class UserSessionService {

    private static final Logger log = LoggerFactory.getLogger(UserSessionService.class);

    @Autowired
    private UserSessionRepository sessionRepository;

    @Autowired
    private InstituteSettingsService settingsService;

    /**
     * Called at login time, BEFORE generating tokens.
     *
     * Returns:
     * - Optional.empty() → institute has no limit, OR under limit → proceed
     * normally
     * - Optional.of(sessions) → limit exceeded → return list to frontend for popup
     *
     * Backward compatible: if instituteId is null or max is 0, always returns
     * empty.
     */
    @Transactional(readOnly = true)
    public Optional<List<ActiveSessionDTO>> checkSessionLimit(String userId, String instituteId) {
        int maxSessions = settingsService.getMaxActiveSessions(instituteId);

        // 0 = unlimited — skip all session checks (default for all existing institutes)
        if (maxSessions <= 0) {
            return Optional.empty();
        }

        List<UserSession> activeSessions = sessionRepository
                .findActiveSessionsByUserIdAndInstituteId(userId, instituteId);

        if (activeSessions.size() < maxSessions) {
            return Optional.empty(); // Under the limit — proceed
        }

        // Limit exceeded — return active sessions for the popup
        log.info("Session limit exceeded for user {} in institute {}. Active: {}, Max: {}",
                userId, instituteId, activeSessions.size(), maxSessions);

        return Optional.of(activeSessions.stream()
                .map(s -> ActiveSessionDTO.builder()
                        .sessionId(s.getId())
                        .deviceType(s.getDeviceType())
                        .ipAddress(s.getIpAddress())
                        .loginTime(s.getLoginTime())
                        .lastActivityTime(s.getLastActivityTime())
                        .build())
                .collect(Collectors.toList()));
    }

    /**
     * Creates a session row immediately after a successful login.
     * The JWT access token is hashed before storing as the session_token for
     * security
     * and to sync with JwtAuthFilter tracking.
     */
    @Transactional
    public void createSession(String userId, String instituteId,
            String accessToken, String deviceType) {
        try {
            String sessionToken = generateSessionIdFromJwt(accessToken);

            // Guard against duplicates (e.g., if gateway triggers createOrUpdateSession
            // first)
            List<UserSession> existing = sessionRepository
                    .findBySessionTokenAndIsActive(sessionToken, true);
            if (!existing.isEmpty())
                return;

            UserSession session = UserSession.builder()
                    .userId(userId)
                    .instituteId(instituteId)
                    .sessionToken(sessionToken)
                    .deviceType(deviceType != null ? deviceType : "WEB")
                    .isActive(true)
                    .loginTime(LocalDateTime.now())
                    .lastActivityTime(LocalDateTime.now())
                    .build();
            sessionRepository.save(session);
            log.debug("Session created for user {} in institute {}", userId, instituteId);
        } catch (Exception e) {
            // Never fail a login because of session tracking
            log.error("Failed to create session for user {} in institute {}: {}", userId, instituteId, e.getMessage());
        }
    }

    /**
     * Terminates ONE specific session by its UUID (user_session.id).
     * Called when the user clicks "Log Out" on one of the session cards in the
     * popup.
     */
    @Transactional
    public void terminateSession(String sessionId) {
        sessionRepository.endSessionById(sessionId, LocalDateTime.now());
        log.info("Session {} terminated via popup", sessionId);
    }

    private String generateSessionIdFromJwt(String jwt) {
        return "jwt_session_" + Integer.toHexString(jwt.hashCode());
    }

    /**
     * Returns the list of active sessions for a user+institute.
     * Used by GET /session/active to refresh the popup.
     */
    @Transactional(readOnly = true)
    public List<ActiveSessionDTO> getActiveSessions(String userId, String instituteId) {
        List<UserSession> sessions = (instituteId != null && !instituteId.isBlank())
                ? sessionRepository.findActiveSessionsByUserIdAndInstituteId(userId, instituteId)
                : sessionRepository.findActiveSessionsByUserId(userId);

        return sessions.stream()
                .map(s -> ActiveSessionDTO.builder()
                        .sessionId(s.getId())
                        .deviceType(s.getDeviceType())
                        .ipAddress(s.getIpAddress())
                        .loginTime(s.getLoginTime())
                        .lastActivityTime(s.getLastActivityTime())
                        .build())
                .collect(Collectors.toList());
    }
}
