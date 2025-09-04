package vacademy.io.notification_service.features.announcements.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.retry.annotation.EnableRetry;

@Configuration
@EnableCaching
@EnableRetry
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        ConcurrentMapCacheManager cacheManager = new ConcurrentMapCacheManager(
                "usersByRole",
                "usersById", 
                "facultyByPackageSessions",
                "studentsByPackageSessions",
                "usersByTags"
        );
        return cacheManager;
    }
}