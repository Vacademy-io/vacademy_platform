package vacademy.io.auth_service.feature.user.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.auth_service.feature.admin_core_service.service.InstitutePolicyService;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Optional;

/**
 * The single place a username or password is changed on an existing user.
 *
 * <p>Before this existed the entry points — the learner's own "Account Details"
 * screen, the admin credential reset, and admin_core's internal profile update —
 * each wrote {@code users.username} straight through their own code path. None
 * told anyone else, so the six denormalized copies across three databases
 * silently drifted (admin_core {@code student}, and four tables in the
 * assessment database, two of which key their rows by username rather than
 * user_id). Routing all three through here means a rename can only happen one
 * way: validate, commit, evict, fan out.
 *
 * <h3>Doing nothing must be free</h3>
 * {@code /internal/update-user} is a warm path — admin_core calls it on lead
 * merges and profile edits, and those payloads carry the user's EXISTING
 * username. So the no-change case exits after a single primary-key read: no
 * write, no cache eviction, no fan-out. Only a genuine change pays for anything.
 *
 * <h3>No transaction around the fan-out</h3>
 * This class is deliberately NOT {@code @Transactional}. The rename has to reach
 * other services over HTTP, and holding a database connection open across that
 * call is what turned a live-session notify into a 511 here before. The two
 * repository calls are each transactional in their own right, and the real
 * guarantee on username uniqueness is {@code uk_users_username}, not the
 * pre-check below — so there is nothing for an enclosing transaction to protect.
 */
@Slf4j
@Service
public class UserCredentialUpdateService {

    private static final String AUTH_USER_DETAILS_CACHE = "authUserDetails";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private InstitutePolicyService institutePolicyService;

    @Autowired
    private CacheManager cacheManager;

    /**
     * Applies a username and/or password change and propagates the rename.
     *
     * <p>Both fields are optional: a blank {@code newUsername} leaves the
     * username alone, a blank {@code newPassword} leaves the password alone.
     * That matches the callers, which send only what changed.
     *
     * @return the user as stored (unmodified when nothing changed)
     */
    public User updateCredentials(String userId, String newUsername, String newPassword) {
        if (!StringUtils.hasText(userId)) {
            throw new VacademyException("userId is required");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new VacademyException("User not found with id " + userId));

        String oldUsername = user.getUsername();
        String requestedUsername = StringUtils.hasText(newUsername) ? newUsername.trim() : null;

        boolean usernameChanged = requestedUsername != null && !requestedUsername.equals(oldUsername);
        boolean passwordChanged = StringUtils.hasText(newPassword) && !newPassword.equals(user.getPassword());

        // The warm no-op path: same username, no new password. Return before
        // touching anything so a lead merge or profile edit costs one PK read.
        if (!usernameChanged && !passwordChanged) {
            return user;
        }

        if (usernameChanged) {
            assertUsernameAvailable(requestedUsername, userId);
            user.setUsername(requestedUsername);
        }
        if (passwordChanged) {
            user.setPassword(newPassword);
        }

        User saved = userRepository.save(user);

        if (usernameChanged) {
            // Only a rename invalidates the cache. A password change does not:
            // UserDetailsCacheService nulls the password before caching, so the
            // cached value never carries one.
            evictAuthUserDetails(userId, oldUsername);
            institutePolicyService.notifyUsernameChanged(userId, oldUsername, requestedUsername);
        }
        return saved;
    }

    /**
     * Drops exactly the {@code authUserDetails} entries for the OLD username.
     *
     * <p>The cache maps username -> identity + roles and is read by
     * {@code /auth-service/v1/internal/user}, which every other service calls to
     * resolve a caller. Without eviction the old username keeps resolving to
     * this user for the rest of the 5-minute TTL — i.e. a username an admin just
     * revoked stays usable across the platform.
     *
     * <p>Keyed {@code username + '_' + instituteId}, so one entry per institute
     * the user belongs to, plus the {@code null} institute variant the login
     * path uses when the username carries no {@code institute@} prefix. That is a
     * handful of precise deletes. The alternative, {@code allEntries = true},
     * resolves to a keyspace scan on the @Primary Redis cache manager and would
     * flush every cached user on the platform — far too blunt to run on a path
     * that admin_core also drives.
     *
     * <p>Best-effort by design: a cache that cannot be evicted must not fail the
     * credential change. The entry expires within 5 minutes regardless.
     */
    private void evictAuthUserDetails(String userId, String oldUsername) {
        if (!StringUtils.hasText(oldUsername)) {
            return;
        }
        try {
            Cache cache = cacheManager.getCache(AUTH_USER_DETAILS_CACHE);
            if (cache == null) {
                return;
            }
            cache.evict(oldUsername + "_" + null);
            List<String> instituteIds = userRoleRepository.findDistinctInstituteIdsByUserId(userId);
            for (String instituteId : instituteIds) {
                cache.evict(oldUsername + "_" + instituteId);
            }
        } catch (Exception e) {
            log.warn("Could not evict authUserDetails for '{}' (expires within its 5-minute TTL): {}",
                    oldUsername, e.getMessage());
        }
    }

    /**
     * Pre-checks {@code uk_users_username} so a taken username comes back as a
     * 510 with a readable message instead of a DataIntegrityViolationException
     * surfacing as an opaque 511. Both UIs key their "username already exists"
     * message off that 510.
     *
     * <p>Check-then-write, so two simultaneous renames onto the same username
     * can still both pass here — the unique constraint is what actually
     * guarantees correctness. This exists for the error message, not the
     * invariant.
     */
    private void assertUsernameAvailable(String username, String userId) {
        Optional<User> existing = userRepository.findByUsername(username);
        if (existing.isPresent() && !existing.get().getId().equals(userId)) {
            throw new VacademyException("Username '" + username + "' is already taken");
        }
    }
}
