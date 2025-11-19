package vacademy.io.auth_service.core.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.data.redis.config.annotation.web.http.EnableRedisHttpSession;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

/**
 * Redis Session Configuration for OAuth2 State Management
 * 
 * This configuration enables Redis-backed session storage specifically for OAuth2 flows.
 * When running multiple replicas of the auth-service, OAuth2 state needs to be shared:
 * - User initiates OAuth → Pod A stores state in Redis
 * - Google redirects back → Pod B retrieves state from Redis
 * - OAuth login succeeds across pods
 * 
 * Note: JWT authentication remains stateless and doesn't use sessions.
 */
@Configuration
@EnableRedisHttpSession(maxInactiveIntervalInSeconds = 1800) // 30 minutes
public class RedisSessionConfig {

    @Bean
    public CookieSerializer cookieSerializer() {
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setCookieName("VACADEMY_OAUTH_SESSION");
        serializer.setCookiePath("/auth-service"); // Scope to auth-service only
        serializer.setDomainNamePattern("^.+?\\.(\\w+\\.[a-z]+)$"); // Allows subdomain sharing
        serializer.setSameSite("Lax"); // Critical for OAuth redirects
        serializer.setUseHttpOnlyCookie(true);
        serializer.setUseSecureCookie(false); // Set to true in production with HTTPS
        return serializer;
    }
}

