# Redis Session Configuration for Multi-Pod OAuth2

## Problem
When running multiple replicas of the auth-service, Google OAuth2 login was failing because:
1. User initiates OAuth → Request hits Pod A → Pod A stores OAuth state in memory
2. Google redirects back → Request hits Pod B → Pod B doesn't have the state → **Login fails**

## Solution
Implemented **Spring Session with Redis** to share OAuth2 state across all pods.

**Important:** This solution only affects OAuth2 flows. JWT-based API authentication remains stateless.

## Changes Made

### 1. Added Dependencies (`pom.xml`)
```xml
<dependency>
    <groupId>org.springframework.session</groupId>
    <artifactId>spring-session-data-redis</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

### 2. Redis Configuration (`application-stage.properties`)
```properties
# Redis Connection
spring.data.redis.host=${REDIS_HOST:redis}
spring.data.redis.port=${REDIS_PORT:6379}
spring.data.redis.timeout=2000ms

# Spring Session
spring.session.store-type=redis
spring.session.redis.namespace=spring:session:auth-service
spring.session.timeout=1800s
```

### 3. Session Management Configuration (`ApplicationSecurityConfig.java`)
Changed from:
```java
.sessionManagement()
.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
```

To:
```java
.sessionManagement(session -> session
    .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
    .maximumSessions(1)
)
```

### 4. Redis Session Config (`RedisSessionConfig.java`)
- Enabled Redis HTTP session with 30-minute timeout
- Configured session cookie settings for OAuth compatibility
- Set SameSite=Lax for OAuth redirects

## Environment Variables
The following environment variables are already injected via ConfigMap:
- `REDIS_HOST`: `redis` (service name)
- `REDIS_PORT`: `6379`

## How It Works
1. When a user starts OAuth login, Spring Security stores the OAuth state in Redis
2. Google redirects back to any pod - that pod retrieves the state from Redis
3. OAuth flow completes successfully regardless of which pod handles which request

## Testing
1. Build and deploy the updated auth-service
2. Scale to 2+ replicas
3. Test Google OAuth login multiple times
4. Verify sessions are working by checking Redis:
   ```bash
   kubectl exec -it redis-<pod-id> -- redis-cli
   KEYS "spring:session:auth-service:*"
   ```

## Notes
- Session cookies are set with `SameSite=Lax` for OAuth compatibility
- `useSecureCookie` is `false` for dev/stage (set to `true` with HTTPS in production)
- Sessions expire after 30 minutes of inactivity
- Maximum 1 concurrent session per user

