package vacademy.io.admin_core_service.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.support.SimpleCacheManager;
import vacademy.io.admin_core_service.features.packages.service.CatalogPopularityService;

import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A {@code @Cacheable} naming a cache the SimpleCacheManager does not list throws at call time,
 * so the public popularity endpoint would 500 on every request. Pin the registration and its
 * 10-minute, size-bounded policy.
 */
class CacheConfigurationCatalogPopularityTest {

    @Test
    @DisplayName("catalogPopularityRanks is registered with a 10-minute TTL and a size bound")
    void popularityCacheIsRegisteredWithTenMinuteTtl() {
        CacheManager manager = new CacheConfiguration().cacheManager();
        ((SimpleCacheManager) manager).afterPropertiesSet();

        Cache cache = manager.getCache(CatalogPopularityService.CACHE_NAME);
        assertThat(cache).as("cache registered under the name the service uses").isNotNull();

        @SuppressWarnings("unchecked")
        com.github.benmanes.caffeine.cache.Cache<Object, Object> nativeCache =
                (com.github.benmanes.caffeine.cache.Cache<Object, Object>) cache.getNativeCache();
        assertThat(nativeCache.policy().expireAfterWrite().orElseThrow().getExpiresAfter(TimeUnit.MINUTES))
                .isEqualTo(10);
        assertThat(nativeCache.policy().eviction().orElseThrow().getMaximum()).isEqualTo(1000);
    }

    @Test
    @DisplayName("Adding the new cache kept every existing cache registered")
    void existingCachesAreStillRegistered() {
        CacheManager manager = new CacheConfiguration().cacheManager();
        ((SimpleCacheManager) manager).afterPropertiesSet();

        assertThat(manager.getCacheNames()).contains(
                "studyLibraryInit", "openInstituteDetails", "learnerModulesStructure",
                "learnerPackageSlidesStructure", "guardianChildren", "parentPortalSettings",
                "lmsConnectionHealth", "catalogPopularityRanks");
    }
}
