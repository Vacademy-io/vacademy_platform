package vacademy.io.admin_core_service.features.live_session.provider.service.google;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.provider.dto.google.GoogleAccount;

/**
 * Fetches and caches OAuth access tokens for connected Google accounts.
 *
 * Google access tokens live ~60 minutes; we cache for 55 (see
 * CacheConfiguration#caffeineCacheGoogleTokenBuilder) so an in-flight request never hits a
 * freshly-expired token. The cache key is the GoogleAccount.id (our own UUID).
 *
 * All token minting goes through {@link GoogleOAuthService#refreshAndGet} (refresh-token
 * grant). Decrypted secrets MUST NOT be logged.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GoogleAccessTokenService {

    private static final String CACHE_NAME = "googleAccessToken";

    private final CacheManager cacheManager;
    private final GoogleOAuthService googleOAuthService;

    /**
     * Returns a valid bearer access token for the given Google account. Hits the cache
     * first; on miss, refreshes via the stored refresh token.
     *
     * @throws vacademy.io.common.exceptions.VacademyException if Google rejects the refresh
     *         token (the account is flipped to RECONNECT_NEEDED inside refreshAndGet)
     */
    public String getAccessToken(GoogleAccount account) {
        Cache cache = cacheManager.getCache(CACHE_NAME);
        if (cache != null) {
            String cached = cache.get(account.getId(), String.class);
            if (cached != null) {
                return cached;
            }
        }
        String token = googleOAuthService.refreshAndGet(account);
        if (cache != null) {
            cache.put(account.getId(), token);
        }
        return token;
    }

    /** Evicts the cached token for an account (after a 401 from the Google API). */
    public void evict(String accountId) {
        Cache cache = cacheManager.getCache(CACHE_NAME);
        if (cache != null) {
            cache.evict(accountId);
        }
    }
}
