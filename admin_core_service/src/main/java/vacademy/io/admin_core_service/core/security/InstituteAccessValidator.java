package vacademy.io.admin_core_service.core.security;

import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.ForbiddenException;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Set;

/**
 * Shared utility to validate that an authenticated user belongs to
 * the institute they are trying to access. Prevents cross-tenant data access.
 *
 * Usage in controllers:
 * <pre>
 *   &#64;Autowired
 *   private InstituteAccessValidator instituteAccessValidator;
 *
 *   // In any endpoint method:
 *   instituteAccessValidator.validateUserAccess(user, instituteId);
 * </pre>
 */
@Component
public class InstituteAccessValidator {

    /**
     * Validates that the given user has an active or invited role in the specified institute.
     * The User entity's roles set is filtered by {@code @Where(clause = "status IN ('ACTIVE', 'INVITED')")}
     * at the JPA level, so only valid roles are checked.
     *
     * @param user        The authenticated user (from @RequestAttribute)
     * @param instituteId The institute ID being accessed
     * @throws VacademyException if the user does not belong to the institute
     */
    public void validateUserAccess(CustomUserDetails user, String instituteId) {
        if (user == null) {
            throw new VacademyException("User authentication required");
        }
        if (instituteId == null || instituteId.isBlank()) {
            throw new VacademyException("Institute ID is required");
        }

        // Root users (platform superadmins) can act on behalf of any institute.
        // This mirrors SuperAdminAuthUtil.requireSuperAdmin and is the same
        // bypass used by SuperAdminCreditController for the credit-grant flow.
        // They may call without a clientId header, which leaves authorities
        // empty, so they must be exempted from the membership checks below.
        if (user.isRootUser()) {
            return;
        }

        Set<UserRole> roles = user.getRoles();
        if (roles != null && !roles.isEmpty()) {
            boolean hasAccess = roles.stream()
                    .anyMatch(role -> instituteId.equals(role.getInstituteId()));
            if (!hasAccess) {
                throw new VacademyException("Access denied: user does not belong to institute " + instituteId);
            }
            return;
        }

        // In this service the principal is rebuilt from auth_service's HTTP
        // payload (UserServiceDTO), which never carries the JPA roles set — so
        // for every non-root caller `roles` is null here. The institute-scoped
        // fact we do have is the authorities list: auth_service mints it by
        // filtering the user's roles to the clientId-header institute, so a
        // non-empty authorities list proves membership in exactly that
        // institute. Spoofing clientId to another institute yields an empty
        // authorities list, and a clientId/instituteId mismatch is rejected
        // below — cross-tenant access stays blocked.
        if (user.getAuthorities() == null || user.getAuthorities().isEmpty()) {
            throw new VacademyException("Access denied: user has no institute associations");
        }

        String clientInstituteId = currentClientIdHeader();
        if (!instituteId.equals(clientInstituteId)) {
            throw new VacademyException("Access denied: user does not belong to institute " + instituteId);
        }
    }

    /**
     * Validates institute membership (see {@link #validateUserAccess}) AND that the caller's
     * role in that institute is specifically ADMIN -- for endpoints that must be restricted to
     * institute admins (e.g. building/managing onboarding flows, completing a step as-admin),
     * not just any institute member (a student or teacher also "belongs" to the institute per
     * {@code validateUserAccess} alone). Root users bypass both checks, same as {@link #validateUserAccess}.
     */
    public void requireAdminAccess(CustomUserDetails user, String instituteId) {
        validateUserAccess(user, instituteId);
        if (user.isRootUser()) {
            return;
        }
        boolean isAdmin = user.getAuthorities() != null && user.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority() != null && a.getAuthority().equalsIgnoreCase("ADMIN"));
        if (!isAdmin) {
            throw new ForbiddenException("Access denied: institute admin role required");
        }
    }

    private String currentClientIdHeader() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servletAttributes) {
            return servletAttributes.getRequest().getHeader("clientId");
        }
        return null;
    }
}
