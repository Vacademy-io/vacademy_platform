package vacademy.io.admin_core_service.core.security;

import java.util.List;

/**
 * The resolved, authorised context for one child a guardian is allowed to read.
 *
 * <p>This is the ONLY key to a child's data in the parent portal. Every
 * {@code ParentPortal*Service} method takes a {@code GuardedChild}, never a
 * bare {@code String childUserId}, so a data path is unreachable without having
 * passed {@link GuardianAccessGuard#requireLinkedChild}. Deny-by-default is
 * enforced by the type system, not by reviewer vigilance.
 *
 * @param childUserId       the child's user id (verified linked to the caller)
 * @param instituteId       the institute the read is scoped to (from the clientId header)
 * @param packageSessionIds the child's ACTIVE enrolments in that institute (never empty)
 * @param fullName          the child's display name
 */
public record GuardedChild(
        String childUserId,
        String instituteId,
        List<String> packageSessionIds,
        String fullName) {
}
