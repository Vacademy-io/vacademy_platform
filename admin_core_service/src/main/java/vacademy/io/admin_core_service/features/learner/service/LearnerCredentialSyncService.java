package vacademy.io.admin_core_service.features.learner.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.learner.client.AssessmentUsernameRenameClient;

/**
 * Middle hop of the username-rename fan-out. auth_service commits
 * {@code users.username}, then calls this; this updates admin_core's own copy
 * ({@code student.username}) and hands the rename on to assessment_service.
 *
 * <p>The admin_core write is synchronous because it is a single indexed bulk
 * UPDATE and the caller wants to know it landed — {@code student.username} is
 * what every learner list and search reads, so a stale value here is visible in
 * the UI immediately. The assessment hop is {@code @Async}: it crosses a
 * service boundary, backs history rather than anything on screen, and must
 * never make an admin sit and wait on it.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LearnerCredentialSyncService {

    private final InstituteStudentRepository instituteStudentRepository;
    private final AssessmentUsernameRenameClient assessmentUsernameRenameClient;

    /**
     * @param userId      auth users.id
     * @param oldUsername username before the change — the only usable predicate
     *                    for the assessment tables, which are keyed by username
     * @param newUsername username now stored in auth users.username
     */
    public void applyUsernameChange(String userId, String oldUsername, String newUsername) {
        if (!StringUtils.hasText(userId) || !StringUtils.hasText(newUsername)) {
            return;
        }
        if (newUsername.equals(oldUsername)) {
            return;
        }

        int studentRows = instituteStudentRepository.updateUsernameByUserId(userId, newUsername);
        log.info("[UsernameRename] userId={} '{}' -> '{}': {} student row(s) updated",
                userId, oldUsername, newUsername, studentRows);

        if (StringUtils.hasText(oldUsername)) {
            // Async lives on the client bean, not on a method of this class — a
            // self-invoked @Async runs on the caller's thread because it never
            // passes through the proxy.
            assessmentUsernameRenameClient.renameUsername(userId, oldUsername, newUsername);
        } else {
            // Without the old value there is no predicate for live_session_response
            // (no user_id column) — skip rather than guess and rewrite someone else's rows.
            log.warn("[UsernameRename] userId={} had no old username supplied; assessment copies NOT synced",
                    userId);
        }
    }
}
