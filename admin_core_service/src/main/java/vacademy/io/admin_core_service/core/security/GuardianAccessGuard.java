package vacademy.io.admin_core_service.core.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.ForbiddenException;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;

/**
 * The security spine of the parent portal. Answers exactly one question:
 * <i>is this child genuinely linked to the guardian named in the caller's
 * token?</i> — and returns a {@link GuardedChild} that is the only key to that
 * child's data.
 *
 * <p><b>Design rule #0 — access is decided by the token, never the request.</b>
 * The guardian id comes from {@code caller.getUserId()} (the JWT); the institute
 * from the {@code clientId} header. Neither is ever read from a URL, query
 * param, or body. There is no {@code parentUserId} parameter anywhere in the
 * parent-portal surface — a parent cannot even express "show me someone else's
 * child".
 *
 * <p>Usage: every {@code /parent-portal} handler's first statement is
 * <pre>GuardedChild child = guard.requireLinkedChild(user, childUserId);</pre>
 *
 * <p>Deny by default. "I couldn't check" (auth_service unreachable) is a
 * <b>503</b>, never a 403 — it must never be cached or reported as "not allowed".
 */
@Slf4j
@Component
public class GuardianAccessGuard {

    private static final String PARENT_ROLE = "PARENT";

    private final GuardianLinkCacheService guardianLinkCacheService;
    private final InstituteAccessValidator instituteAccessValidator;
    private final StudentSessionInstituteGroupMappingRepository ssigmRepository;

    public GuardianAccessGuard(GuardianLinkCacheService guardianLinkCacheService,
                               InstituteAccessValidator instituteAccessValidator,
                               StudentSessionInstituteGroupMappingRepository ssigmRepository) {
        this.guardianLinkCacheService = guardianLinkCacheService;
        this.instituteAccessValidator = instituteAccessValidator;
        this.ssigmRepository = ssigmRepository;
    }

    /**
     * Resolve and authorise a child for the calling guardian, or throw.
     *
     * @throws ForbiddenException (403) if the caller is not authenticated, the
     *         child is not linked, the caller is not a guardian, or the child is
     *         not enrolled in the caller's institute.
     * @throws VacademyException (503) if the authoritative link source
     *         (auth_service) cannot be reached — deliberately distinct from 403.
     */
    public GuardedChild requireLinkedChild(CustomUserDetails caller, String requestedChildUserId) {
        // 1. deny-by-default preconditions
        if (caller == null || isBlank(caller.getUserId())) {
            throw new ForbiddenException("Authentication required");
        }
        if (isBlank(requestedChildUserId)) {
            throw new ForbiddenException("Child not specified");
        }

        String parentUserId = caller.getUserId();

        // 2. tenant leg — institute comes from the clientId HEADER, never a param.
        String instituteId = currentClientIdHeader();
        if (isBlank(instituteId)) {
            throw new ForbiddenException("clientId header required");
        }
        // Throws on mismatch / no membership; roots are exempted inside.
        instituteAccessValidator.validateUserAccess(caller, instituteId);

        // 3. self leg — a learner reading their own data through the shared BFF.
        if (parentUserId.equals(requestedChildUserId)) {
            return buildContext(requestedChildUserId, instituteId, caller.getFullName());
        }

        // 4. role leg — defence in depth; the link leg alone is already sufficient.
        if (!hasAuthority(caller, PARENT_ROLE)) {
            throw new ForbiddenException("Not a guardian");
        }

        // 5. link leg — AUTHORITATIVE (auth_service). Unreachable => 503, not 403.
        List<UserDTO> children;
        try {
            children = guardianLinkCacheService.childrenOf(parentUserId);
        } catch (Exception e) {
            log.warn("Guardian link check unavailable for parent {}: {}", parentUserId, e.getMessage());
            throw new VacademyException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Guardian link verification is temporarily unavailable");
        }
        UserDTO matched = children == null ? null
                : children.stream()
                        .filter(c -> requestedChildUserId.equals(c.getId()))
                        .findFirst()
                        .orElse(null);
        if (matched == null) {
            // enumeration signal — the only place we learn a parent probed a foreign child
            log.warn("Guardian access DENIED: parent={} attempted child={} institute={}",
                    parentUserId, requestedChildUserId, instituteId);
            throw new ForbiddenException("Child is not linked to this guardian");
        }

        // 6. enrolment leg — child must actually be in THIS institute.
        return buildContext(requestedChildUserId, instituteId, matched.getFullName());
    }

    /**
     * Boolean sibling of {@link #requireLinkedChild} for call sites that must
     * NOT throw (e.g. a {@code process == null || !canAccess(...)} expression,
     * where throwing would turn a clean 404 into a 500). Fails closed on any
     * error, including auth_service being unreachable. Does not perform the
     * institute/enrolment legs — it answers only "is this child linked to this
     * guardian?", which is the widening leg for report access.
     */
    public boolean isLinkedChild(CustomUserDetails caller, String childUserId) {
        try {
            if (caller == null || isBlank(caller.getUserId()) || isBlank(childUserId)) {
                return false;
            }
            if (caller.getUserId().equals(childUserId)) {
                return true;
            }
            if (!hasAuthority(caller, PARENT_ROLE)) {
                return false;
            }
            List<UserDTO> children = guardianLinkCacheService.childrenOf(caller.getUserId());
            return children != null && children.stream().anyMatch(c -> childUserId.equals(c.getId()));
        } catch (Exception e) {
            // fail closed — an unreachable auth_service must never grant access
            return false;
        }
    }

    /**
     * For the {@code /children} listing: validate the caller is a guardian in the
     * clientId institute, and return their linked children. Enrolment is NOT
     * checked here — the caller enriches each child per-institute and drops those
     * not enrolled in the clientId institute (empty batches = not in this institute).
     *
     * @throws ForbiddenException (403) if not authenticated / not a guardian / wrong institute
     * @throws VacademyException (503) if auth_service is unreachable
     */
    public List<UserDTO> listGuardianChildren(CustomUserDetails caller) {
        if (caller == null || isBlank(caller.getUserId())) {
            throw new ForbiddenException("Authentication required");
        }
        String instituteId = currentClientIdHeader();
        if (isBlank(instituteId)) {
            throw new ForbiddenException("clientId header required");
        }
        instituteAccessValidator.validateUserAccess(caller, instituteId);
        if (!hasAuthority(caller, PARENT_ROLE)) {
            throw new ForbiddenException("Not a guardian");
        }
        try {
            List<UserDTO> children = guardianLinkCacheService.childrenOf(caller.getUserId());
            return children == null ? List.of() : children;
        } catch (Exception e) {
            log.warn("Guardian link listing unavailable for parent {}: {}", caller.getUserId(), e.getMessage());
            throw new VacademyException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Guardian link verification is temporarily unavailable");
        }
    }

    private GuardedChild buildContext(String childUserId, String instituteId, String fullName) {
        List<String> packageSessionIds = ssigmRepository
                .findEnrolledPackageSessionIds(childUserId, instituteId);
        if (packageSessionIds == null || packageSessionIds.isEmpty()) {
            throw new ForbiddenException("Child is not enrolled in this institute");
        }
        return new GuardedChild(childUserId, instituteId, packageSessionIds, fullName);
    }

    private boolean hasAuthority(CustomUserDetails caller, String role) {
        if (caller.getAuthorities() == null) {
            return false;
        }
        return caller.getAuthorities().stream()
                .anyMatch(a -> role.equalsIgnoreCase(a.getAuthority()));
    }

    private String currentClientIdHeader() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servletAttributes) {
            return servletAttributes.getRequest().getHeader("clientId");
        }
        return null;
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
