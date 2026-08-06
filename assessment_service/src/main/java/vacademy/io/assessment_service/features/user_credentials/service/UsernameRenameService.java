package vacademy.io.assessment_service.features.user_credentials.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.assessment_service.features.user_credentials.dto.UsernameRenameRequest;
import vacademy.io.assessment_service.features.user_credentials.dto.UsernameRenameResponse;
import vacademy.io.common.exceptions.VacademyException;

/**
 * Rewrites a learner's denormalized username across every table in the
 * assessment database (which community_service shares — see its
 * {@code spring.datasource.url=${ASSESSMENT_SERVICE_DB_URL}}).
 *
 * <p><b>Why bulk SQL and not entity loads:</b> the whole point of this fan-out
 * is that a rename must not cost anything meaningful. Each statement below is a
 * single index-scan-driven UPDATE touching only that learner's rows — no
 * select-then-save round trips, no Hibernate dirty-checking over a result set
 * that could be thousands of live-session responses. V36 adds the three missing
 * username indexes so none of these degrades into a seq scan.
 *
 * <p><b>Why one transaction:</b> four statements, one connection, one commit.
 * The pool here is small (see ARCHITECTURE.md §8.2), so fanning these out into
 * per-table {@code REQUIRES_NEW} transactions would hold several connections at
 * once for no benefit — either the whole rename lands or none of it does, which
 * is also the easier state to reason about when re-running.
 *
 * <p>{@code live_session_participant} is the one table that can legitimately
 * refuse a row: {@code UNIQUE (session_id, username)} means a session that
 * already contains the new username cannot take another. Rather than let that
 * abort the transaction and lose the other three tables, the statement skips
 * those rows with a NOT EXISTS guard and the count is reported back so the
 * skip is visible rather than silent.
 */
@Slf4j
@Service
public class UsernameRenameService {

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public UsernameRenameResponse rename(UsernameRenameRequest request) {
        if (request == null) {
            throw new VacademyException("rename request body is required");
        }
        String oldUsername = trimToNull(request.getOldUsername());
        String newUsername = trimToNull(request.getNewUsername());

        if (oldUsername == null || newUsername == null) {
            throw new VacademyException("old_username and new_username are both required");
        }
        if (oldUsername.equals(newUsername)) {
            // Not an error: the caller fans out on any credential change, and a
            // password-only change leaves the username untouched.
            return UsernameRenameResponse.builder().build();
        }

        int registrationRows = execute("""
                UPDATE assessment_user_registration
                   SET username = :newUsername
                 WHERE username = :oldUsername
                """, oldUsername, newUsername);

        int accessRows = execute("""
                UPDATE assessment_user_access
                   SET username = :newUsername
                 WHERE username = :oldUsername
                """, oldUsername, newUsername);

        // ORDER MATTERS: responses are scoped through live_session_participant by
        // the OLD username, so this MUST run before the participant rows are
        // renamed — afterwards that subquery would match nothing and every
        // response would be silently left behind.
        //
        // The session_id scope exists so this table needs no username index of
        // its own (see V36): session_id leads idx_live_session_response_session_slide,
        // so this index-scans only the sessions the learner attended instead of
        // scanning the largest, most write-heavy table in the database.
        //
        // Assumes a response implies a participant row for the same
        // (session, username) — true because a learner has to join a session to
        // answer in it, and the join is what writes the participant row.
        int responseRows = execute("""
                UPDATE live_session_response
                   SET username = :newUsername
                 WHERE username = :oldUsername
                   AND session_id IN (
                       SELECT session_id FROM live_session_participant
                        WHERE username = :oldUsername)
                """, oldUsername, newUsername);

        // Count first so the conflict skew below is attributable; both queries
        // ride the same index, so this is two cheap lookups rather than one.
        int participantMatches = ((Number) entityManager
                .createNativeQuery("SELECT COUNT(*) FROM live_session_participant WHERE username = :oldUsername")
                .setParameter("oldUsername", oldUsername)
                .getSingleResult()).intValue();

        int participantRows = execute("""
                UPDATE live_session_participant p
                   SET username = :newUsername
                 WHERE p.username = :oldUsername
                   AND NOT EXISTS (
                       SELECT 1 FROM live_session_participant q
                        WHERE q.session_id = p.session_id
                          AND q.username = :newUsername)
                """, oldUsername, newUsername);

        UsernameRenameResponse response = UsernameRenameResponse.builder()
                .assessmentUserRegistrationRows(registrationRows)
                .assessmentUserAccessRows(accessRows)
                .liveSessionParticipantRows(participantRows)
                .liveSessionResponseRows(responseRows)
                .liveSessionParticipantConflicts(participantMatches - participantRows)
                .build();

        if (response.getLiveSessionParticipantConflicts() > 0) {
            log.warn("[UsernameRename] userId={} '{}' -> '{}': {} live_session_participant row(s) kept the old "
                            + "username because their session already has a participant named '{}'",
                    request.getUserId(), oldUsername, newUsername,
                    response.getLiveSessionParticipantConflicts(), newUsername);
        }

        log.info("[UsernameRename] userId={} '{}' -> '{}': registrations={} access={} participants={} responses={}",
                request.getUserId(), oldUsername, newUsername,
                registrationRows, accessRows, participantRows, responseRows);

        return response;
    }

    private int execute(String sql, String oldUsername, String newUsername) {
        return entityManager.createNativeQuery(sql)
                .setParameter("oldUsername", oldUsername)
                .setParameter("newUsername", newUsername)
                .executeUpdate();
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
