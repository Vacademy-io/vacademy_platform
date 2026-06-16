package vacademy.io.notification_service.features.chat.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Set;
import java.util.stream.Collectors;

/**
 * Trusted caller identity for chat endpoints, derived from the authenticated JWT principal — NOT from
 * client-supplied request params. The principal is already scoped to the institute in the {@code clientId}
 * header (the JWT filter loads institute-scoped authorities), so:
 * <ul>
 *   <li>userId comes from the principal,</li>
 *   <li>instituteId is the verified clientId header,</li>
 *   <li>role is resolved from the principal's authorities for that institute, and</li>
 *   <li>a caller with NO authority for the institute is rejected (cross-tenant guard).</li>
 * </ul>
 */
public record ChatIdentity(String userId, String instituteId, String role, String name) {

    public static ChatIdentity from(CustomUserDetails user, String clientId) {
        if (user == null || user.getUserId() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
        }
        if (clientId == null || clientId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INSTITUTE_REQUIRED");
        }

        Set<String> authorities = user.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a != null)
                .map(String::toUpperCase)
                .collect(Collectors.toSet());

        // The principal's authorities are scoped to the clientId institute; an empty set means the
        // user holds no role there, so they do not belong to this institute.
        if (authorities.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "NOT_IN_INSTITUTE");
        }

        String role = resolveRole(authorities);
        String name = user.getFullName() != null && !user.getFullName().isBlank()
                ? user.getFullName()
                : user.getUsername();
        return new ChatIdentity(user.getUserId(), clientId, role, name);
    }

    /** Highest-privilege role wins (ADMIN > TEACHER > STUDENT); default to least privilege. */
    private static String resolveRole(Set<String> authorities) {
        if (authorities.contains("ADMIN")) return "ADMIN";
        if (authorities.contains("TEACHER") || authorities.contains("FACULTY")) return "TEACHER";
        if (authorities.contains("STUDENT") || authorities.contains("LEARNER")) return "STUDENT";
        return "STUDENT";
    }

    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }
}
