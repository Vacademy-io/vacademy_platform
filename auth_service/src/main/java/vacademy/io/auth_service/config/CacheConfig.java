package vacademy.io.auth_service.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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
public class CacheConfig implements org.springframework.cache.annotation.CachingConfigurer {

    /**
     * Degrade cache failures to cache MISSES instead of propagating them to the caller.
     *
     * <p>Spring's default {@code SimpleCacheErrorHandler} rethrows, so an unreadable Redis entry
     * escaped the {@code @Cacheable} method. In prod that took down
     * {@code GET /auth-service/v1/users/by-role}: the controller's catch-all mapped the exception to
     * HTTP 400, admin_core_service's role lookup treated the non-2xx as "no users", and doubts were
     * created with zero recipients — no email, no push, no bell. Whether a cache can be read is never
     * a good reason to fail a request: on a read error we log and return null, and Spring then just
     * invokes the underlying method and re-populates the entry.</p>
     */
    @Override
    public org.springframework.cache.interceptor.CacheErrorHandler errorHandler() {
        return new org.springframework.cache.interceptor.CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException exception,
                                            org.springframework.cache.Cache cache, Object key) {
                // Null return ⇒ treated as a miss ⇒ the real method runs. Never fail the request.
                log.warn("Cache GET failed for cache '{}' key '{}' — falling back to the source: {}",
                        cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCachePutError(RuntimeException exception,
                                            org.springframework.cache.Cache cache, Object key, Object value) {
                log.warn("Cache PUT failed for cache '{}' key '{}' — value not cached: {}",
                        cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCacheEvictError(RuntimeException exception,
                                              org.springframework.cache.Cache cache, Object key) {
                log.warn("Cache EVICT failed for cache '{}' key '{}': {}",
                        cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCacheClearError(RuntimeException exception,
                                              org.springframework.cache.Cache cache) {
                log.warn("Cache CLEAR failed for cache '{}': {}", cache.getName(), exception.getMessage());
            }
        };
    }

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
     * ObjectMapper backing the Redis cache serializer.
     *
     * <p>Exposed (package-visible, static) so tests exercise the REAL production configuration
     * rather than a hand-copied duplicate that can silently drift out of sync.</p>
     *
     * <p><b>FAIL_ON_UNKNOWN_PROPERTIES is disabled deliberately.</b> Cached entities may expose
     * derived, read-only getters — {@code User.getUserTopLevelDto()} is one: Jackson happily writes
     * a {@code userTopLevelDto} property but there is no field or setter to read it back into. With
     * the default strict setting, every read of such an entry threw
     * {@code UnrecognizedPropertyException}, the {@code @Cacheable} call propagated it, and the
     * controller's catch-all turned it into an HTTP 400. Tolerating unknown properties lets the
     * cache drop computed fields on the way back in, which is exactly what we want — they are
     * recomputed from the real fields by the getter anyway.</p>
     */
    static com.fasterxml.jackson.databind.ObjectMapper cacheObjectMapper() {
        com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
        objectMapper.registerModule(new org.springframework.security.jackson2.CoreJackson2Module());
        objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
        objectMapper.disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        objectMapper.disable(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

        // Default typing so polymorphic values survive the round trip. NOTE: NON_FINAL means Jackson
        // writes NO type id for final runtime types — including java.util.ImmutableCollections$ListN,
        // what Stream.toList() returns. Such a value serializes fine and then fails to deserialize.
        // Cached methods must therefore return a non-final collection (see UserResolutionService).
        objectMapper.activateDefaultTyping(
                objectMapper.getPolymorphicTypeValidator(),
                com.fasterxml.jackson.databind.ObjectMapper.DefaultTyping.NON_FINAL,
                com.fasterxml.jackson.annotation.JsonTypeInfo.As.PROPERTY
        );
        return objectMapper;
    }

    /**
     * Primary cache manager using Redis for distributed caching
     */
    @Primary
    @Bean(name = "redisCacheManager")
    public CacheManager redisCacheManager(RedisConnectionFactory connectionFactory) {
        log.info("Initializing Redis cache manager for analytics");

        GenericJackson2JsonRedisSerializer serializer =
                new GenericJackson2JsonRedisSerializer(cacheObjectMapper());

        // Default cache configuration
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(5))
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(serializer))
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
        cacheConfigurations.put(ANALYTICS_MOST_ACTIVE_USERS_CACHE, defaultConfig.entryTtl(Duration.ofMinutes(10)));

        // Currently active users - 30 seconds (real-time data)
        cacheConfigurations.put(ANALYTICS_CURRENTLY_ACTIVE_CACHE, defaultConfig.entryTtl(Duration.ofSeconds(30)));

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
    @Bean(name = "caffeineCacheManager")
    public CacheManager caffeineCacheManager() {
        log.info("Initializing Caffeine cache manager for analytics");

        
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
