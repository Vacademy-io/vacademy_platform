package vacademy.io.admin_core_service.features.learner.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * HMAC client for the last hop of the username-rename fan-out: tells
 * assessment_service to rewrite the four username copies in its database
 * (assessment_user_registration, assessment_user_access,
 * live_session_participant, live_session_response).
 *
 * <p>Same {@link InternalClientUtils#makeHmacRequest} pattern as
 * {@code AssessmentRegistrationClient}. Unlike that one, this retries once:
 * a dropped rename leaves the learner's assessment and live-class history
 * stranded under a username that no longer exists, and nothing else in the
 * system will ever notice or repair it. One cheap retry covers the common
 * failure (a pod restarting mid-deploy); anything beyond that is logged loudly
 * enough to be found, since the fix is to re-issue the rename by hand.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AssessmentUsernameRenameClient {

    private static final String ROUTE = "/assessment-service/internal/user-credentials/v1/rename";

    private final InternalClientUtils internalClientUtils;

    @Value("${assessment.server.baseurl:http://localhost:8074}")
    private String assessmentServiceBaseUrl;

    @Value("${spring.application.name:admin_core_service}")
    private String clientName;

    /**
     * {@code @Async} lives here, on the client bean, so callers get the proxy —
     * a caller cannot make this asynchronous by annotating its own method and
     * self-invoking it.
     */
    @Async
    public void renameUsername(String userId, String oldUsername, String newUsername) {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("user_id", userId);
        body.put("old_username", oldUsername);
        body.put("new_username", newUsername);

        for (int attempt = 1; attempt <= 2; attempt++) {
            try {
                ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                        clientName, "POST", assessmentServiceBaseUrl, ROUTE, body);

                if (response != null && response.getStatusCode() == HttpStatus.OK) {
                    log.info("[UsernameRename] assessment copies updated for userId={} '{}' -> '{}': {}",
                            userId, oldUsername, newUsername, response.getBody());
                    return;
                }
                log.warn("[UsernameRename] attempt {}/2 returned {} for userId={} '{}' -> '{}'",
                        attempt, response == null ? "no-response" : response.getStatusCode(),
                        userId, oldUsername, newUsername);
            } catch (Exception e) {
                log.warn("[UsernameRename] attempt {}/2 failed for userId={} '{}' -> '{}': {}",
                        attempt, userId, oldUsername, newUsername, e.getMessage());
            }
        }

        // Loud on final failure: auth + admin_core have already committed the new
        // username, so the assessment copies are now provably stale. Re-run by
        // POSTing {user_id, old_username, new_username} to ROUTE.
        log.error("[UsernameRename] GAVE UP syncing assessment copies for userId={} '{}' -> '{}'. "
                        + "assessment_user_registration / assessment_user_access / live_session_participant / "
                        + "live_session_response still hold the OLD username. Replay: POST {} {}",
                userId, oldUsername, newUsername, ROUTE, body);
    }
}
