package vacademy.io.admin_core_service.core.security;

import org.springframework.stereotype.Component;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.model.CustomUserDetails;
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

        Set<UserRole> roles = user.getRoles();
        if (roles == null || roles.isEmpty()) {
            throw new VacademyException("Access denied: user has no institute associations");
        }

        boolean hasAccess = roles.stream()
                .anyMatch(role -> instituteId.equals(role.getInstituteId()));

        if (!hasAccess) {
            throw new VacademyException("Access denied: user does not belong to institute " + instituteId);
        }
    }
}
