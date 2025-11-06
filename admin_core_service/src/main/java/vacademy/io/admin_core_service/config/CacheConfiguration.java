package vacademy.io.admin_core_service.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/**
 * Cache configuration for application-level caching.
 * 
 * Currently configured caches:
 * - studyLibraryInit: Caches study library initialization data (TTL: 20 seconds)
 */
@Configuration
@EnableCaching
public class CacheConfiguration {

    /**
     * Configure Caffeine-based cache manager with custom TTL per cache
     */
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        cacheManager.setCaffeine(caffeineCacheBuilder());
        return cacheManager;
    }

    /**
     * Caffeine cache configuration with 20-second TTL
     * - Maximum size: 1000 entries to prevent memory issues
     * - Expire after write: 20 seconds
     */
    private Caffeine<Object, Object> caffeineCacheBuilder() {
        return Caffeine.newBuilder()
                .maximumSize(1000)
                .expireAfterWrite(20, TimeUnit.SECONDS)
                .recordStats(); // Enable statistics for monitoring
    }
}

