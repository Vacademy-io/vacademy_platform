package vacademy.io.admin_core_service.features.live_session.provider.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionParticipantRepository;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Objects;
import java.util.Set;

/**
 * Provider-agnostic authorization for joining a live session.
 *
 * Centralises the three checks every SDK-join / join-link endpoint needs so no
 * controller trusts a client-supplied role and every join is scoped to the
 * session's institute and enrolment:
 *  1. <b>Cross-institute isolation</b> — if the caller asserts an institute it must
 *     match the session's. For learners the enrolment check below is the real
 *     isolation boundary (a user from another institute is not a participant).
 *  2. <b>Host role derived server-side</b> — HOST iff the caller created the session
 *     or holds an admin/teacher authority; never from a request parameter. ZAK /
 *     moderator privileges are therefore only granted to legitimate hosts.
 *  3. <b>Participant enrolment gate</b> — a non-host must be an enrolled participant
 *     (USER or ACTIVE BATCH membership), unless the session is public.
 *
 * Returns a {@link JoinAuthorization}; throws {@link VacademyException} (403/404)
 * otherwise.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LiveSessionJoinAuthorizer {

    /**
     * Authorities that may host a session even when they did not create it. These
     * are minted per-institute on the JWT (see {@code CustomUserDetails}), so an
     * admin authority implies admin-of-that-institute.
     */
    private static final Set<String> HOST_AUTHORITIES = Set.of("ADMIN", "INSTITUTE_ADMIN", "TEACHER");

    private final SessionScheduleRepository scheduleRepository;
    private final LiveSessionRepository liveSessionRepository;
    private final LiveSessionParticipantRepository participantRepository;
    private final InstituteAccessValidator instituteAccessValidator;

    /**
     * @param scheduleId          the schedule the caller wants to join
     * @param user                the authenticated principal
     * @param requestedInstituteId optional institute the caller asserts; when present
     *                             it must equal the session's institute (defence in depth)
     */
    public JoinAuthorization authorize(String scheduleId, CustomUserDetails user, String requestedInstituteId) {
        if (user == null || user.getUserId() == null) {
            throw new VacademyException(HttpStatus.UNAUTHORIZED, "Authentication required to join this session");
        }

        SessionSchedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Schedule not found: " + scheduleId));

        LiveSession session = liveSessionRepository.findById(schedule.getSessionId())
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND,
                        "Live session not found for schedule: " + scheduleId));

        String instituteId = session.getInstituteId();

        if (requestedInstituteId != null && !requestedInstituteId.isBlank()
                && !requestedInstituteId.equals(instituteId)) {
            log.warn("live.join.denied scheduleId={} userId={} reason=institute_mismatch requested={} actual={}",
                    scheduleId, user.getUserId(), requestedInstituteId, instituteId);
            throw new VacademyException(HttpStatus.FORBIDDEN, "This session belongs to a different institute");
        }

        boolean isCreator = Objects.equals(user.getUserId(), session.getCreatedByUserId());
        if (isCreator || isStaffOfInstitute(user, instituteId)) {
            return new JoinAuthorization(JoinRole.HOST, instituteId);
        }

        boolean isPublic = "public".equalsIgnoreCase(session.getAccessLevel());
        boolean enrolled = participantRepository.isUserParticipantOfSession(session.getId(), user.getUserId());
        if (!enrolled && !isPublic) {
            log.warn("live.join.denied scheduleId={} userId={} reason=not_enrolled", scheduleId, user.getUserId());
            throw new VacademyException(HttpStatus.FORBIDDEN, "You are not enrolled in this session");
        }

        return new JoinAuthorization(JoinRole.PARTICIPANT, instituteId);
    }

    /**
     * HOST-by-authority: the caller holds an admin/teacher authority AND that
     * authority is for THIS session's institute. Authorities are minted per the
     * institute the caller authenticated against (clientId header), so we verify
     * institute membership via {@link InstituteAccessValidator} — without this an
     * admin of institute A could host institute B's meeting. The creator path
     * (handled separately) is institute-agnostic and unforgeable.
     */
    private boolean isStaffOfInstitute(CustomUserDetails user, String instituteId) {
        if (!hasHostAuthority(user)) {
            return false;
        }
        try {
            instituteAccessValidator.validateUserAccess(user, instituteId);
            return true;
        } catch (Exception e) {
            // Has an admin/teacher authority, but not in this session's institute.
            log.warn("live.join.host_denied instituteId={} userId={} reason=not_staff_of_institute",
                    instituteId, user.getUserId());
            return false;
        }
    }

    private boolean hasHostAuthority(CustomUserDetails user) {
        if (user.getAuthorities() == null) {
            return false;
        }
        return user.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(Objects::nonNull)
                .map(String::toUpperCase)
                .anyMatch(HOST_AUTHORITIES::contains);
    }
}
