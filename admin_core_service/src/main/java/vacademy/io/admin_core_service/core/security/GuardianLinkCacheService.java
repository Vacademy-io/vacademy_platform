package vacademy.io.admin_core_service.core.security;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.parent_link.service.ParentLinkService;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;

/**
 * Caches the authoritative guardian&rarr;children lookup.
 *
 * <p>Lives in its own bean (not on {@link GuardianAccessGuard}) so the Spring
 * cache proxy is actually applied — a {@code @Cacheable} method invoked from
 * within the same class would bypass the proxy (self-invocation).
 *
 * <p><b>Authoritative source only.</b> This resolves against auth_service (via
 * {@link ParentLinkService#getChildrenOfParent}), never the local
 * {@code student.guardian_user_id} mirror — that mirror can be affirmatively
 * <i>wrong</i> in the permissive direction (it is overwritten unconditionally
 * while auth_service is back-fill-only), so it must never gate access. Do not
 * "optimise" this into a local lookup.
 *
 * <p>Keyed on {@code parentUserId} alone: the guardian link is
 * institute-independent, so the same children list serves every per-child
 * check and the {@code /children} listing. Empty/failed results are NOT cached
 * ({@code unless}), so a transient auth_service blip can't lock a guardian out
 * for the full TTL.
 */
@Service
public class GuardianLinkCacheService {

    private final ParentLinkService parentLinkService;

    public GuardianLinkCacheService(ParentLinkService parentLinkService) {
        this.parentLinkService = parentLinkService;
    }

    @Cacheable(value = "guardianChildren", key = "#parentUserId", unless = "#result == null || #result.isEmpty()")
    public List<UserDTO> childrenOf(String parentUserId) {
        return parentLinkService.getChildrenOfParent(parentUserId);
    }
}
