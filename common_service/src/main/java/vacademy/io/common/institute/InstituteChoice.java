package vacademy.io.common.institute;

import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;

import java.util.List;

/**
 * Picks the institute to send a user-directed email as.
 *
 * <p>Exists so the six places that mail a user their credentials, an invitation or a welcome note
 * share one answer to "which of this user's institutes is this?". They each used to inline
 * {@code user.getRoles().iterator().next().getInstituteId()} — an arbitrary element of an unordered
 * {@link java.util.Set}, which for a multi-institute user can send one institute's learner a
 * password from another institute's address.
 *
 * @see OriginInstituteResolver#chooseInstituteIdFor for the selection rule and its fallbacks
 */
public final class InstituteChoice {

    private InstituteChoice() {
    }

    /**
     * The institute to send as for {@code user}, or null when the user has no institute role.
     *
     * <p>Safe to call off a request thread: the resolver simply cannot consult a request host
     * there and the choice degrades to the historical first-role behaviour.
     */
    public static String forUser(OriginInstituteResolver resolver, User user) {
        if (user == null || user.getRoles() == null || user.getRoles().isEmpty()) {
            return null;
        }
        List<String> instituteIds = user.getRoles().stream()
                .map(UserRole::getInstituteId)
                .toList();
        return resolver.chooseInstituteIdFor(instituteIds);
    }
}
