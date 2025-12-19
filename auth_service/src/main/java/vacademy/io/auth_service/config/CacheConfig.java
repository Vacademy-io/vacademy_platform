package vacademy.io.auth_service.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Configuration
@EnableCaching
public class CacheConfig {

        @Value("${spring.cache.type:redis}")
        private String cacheType;

        // Cache names
        public static final String ANALYTICS_CACHE = "analytics";
        public static final String ANALYTICS_ACTIVE_USERS_CACHE = "analytics:active-users";
        public static final String ANALYTICS_TODAY_CACHE = "analytics:today";
        public static final String ANALYTICS_SERVICE_USAGE_CACHE = "analytics:service-usage";
        public static final String ANALYTICS_TRENDS_CACHE = "analytics:trends";
        public static final String ANALYTICS_MOST_ACTIVE_USERS_CACHE = "analytics:most-active-users";
        public static final String ANALYTICS_CURRENTLY_ACTIVE_CACHE = "analytics:currently-active";
        public static final String ANALYTICS_REALTIME_CACHE = "analytics:realtime";

        /**
         * Primary cache manager using Redis for distributed caching
         */
        @Primary
        @Bean(name = "redisCacheManager")
        @ConditionalOnProperty(name = "spring.cache.type", havingValue = "redis", matchIfMissing = true)
        public CacheManager redisCacheManager(RedisConnectionFactory connectionFactory) {
                log.info("Initializing Redis cache manager for analytics");

                // Default cache configuration
                RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                                .entryTtl(Duration.ofMinutes(5))
                                .serializeKeysWith(RedisSerializationContext.SerializationPair
                                                .fromSerializer(new StringRedisSerializer()))
                                .serializeValuesWith(RedisSerializationContext.SerializationPair
                                                .fromSerializer(new GenericJackson2JsonRedisSerializer()))
                                .disableCachingNullValues();

                // Custom cache configurations with different TTL
                Map<String, RedisCacheConfiguration> cacheConfigurations = new HashMap<>();

                // Analytics - 5 minutes (general analytics)
                cacheConfigurations.put(ANALYTICS_CACHE, defaultConfig.entryTtl(Duration.ofMinutes(5)));

                // Active users - 1 minute (more frequently updated)
                cacheConfigurations.put(ANALYTICS_ACTIVE_USERS_CACHE, defaultConfig.entryTtl(Duration.ofMinutes(1)));

                // Today's activity - 2 minutes
                cacheConfigurations.put(ANALYTICS_TODAY_CACHE, defaultConfig.entryTtl(Duration.ofMinutes(2)));

                // Service usage - 10 minutes (less frequently changes)
                cacheConfigurations.put(ANALYTICS_SERVICE_USAGE_CACHE, defaultConfig.entryTtl(Duration.ofMinutes(10)));

                // Engagement trends - 15 minutes (historical data)
                cacheConfigurations.put(ANALYTICS_TRENDS_CACHE, defaultConfig.entryTtl(Duration.ofMinutes(15)));

                // Most active users - 10 minutes
                cacheConfigurations.put(ANALYTICS_MOST_ACTIVE_USERS_CACHE,
                                defaultConfig.entryTtl(Duration.ofMinutes(10)));

                // Currently active users - 30 seconds (real-time data)
                cacheConfigurations.put(ANALYTICS_CURRENTLY_ACTIVE_CACHE,
                                defaultConfig.entryTtl(Duration.ofSeconds(30)));

                // Real-time active users - 30 seconds
                cacheConfigurations.put(ANALYTICS_REALTIME_CACHE, defaultConfig.entryTtl(Duration.ofSeconds(30)));

                return RedisCacheManager.builder(connectionFactory)
                                .cacheDefaults(defaultConfig)
                                .withInitialCacheConfigurations(cacheConfigurations)
                                .transactionAware()
                                .build();
        }

        /**
         * Fallback cache manager using Caffeine for local in-memory caching
         * Used when Redis is unavailable
         */
        @Primary
        @Bean(name = "caffeineCacheManager")
        @ConditionalOnProperty(name = "spring.cache.type", havingValue = "caffeine")
        public CacheManager caffeineCacheManager() {
                log.info("Initializing Caffeine cache manager as fallback");

                CaffeineCacheManager cacheManager = new CaffeineCacheManager(
                                ANALYTICS_CACHE,
                                ANALYTICS_ACTIVE_USERS_CACHE,
                                ANALYTICS_TODAY_CACHE,
                                ANALYTICS_SERVICE_USAGE_CACHE,
                                ANALYTICS_TRENDS_CACHE,
                                ANALYTICS_MOST_ACTIVE_USERS_CACHE,
                                ANALYTICS_CURRENTLY_ACTIVE_CACHE,
                                ANALYTICS_REALTIME_CACHE);

                cacheManager.setCaffeine(Caffeine.newBuilder()
                                .maximumSize(1000)
                                .expireAfterWrite(5, TimeUnit.MINUTES)
                                .recordStats());

                return cacheManager;
        }
}
