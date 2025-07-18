# Session Token Extraction Implementation Guide

## Overview
This guide provides implementation strategies for extracting session tokens in different authentication scenarios across services.

## Implementation Options

### 1. JWT Token-Based Session Extraction

```java
private String extractSessionToken() {
    try {
        // Extract from Spring Security Context
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        
        if (authentication != null && authentication.getCredentials() != null) {
            String credentials = authentication.getCredentials().toString();
            
            // If using JWT tokens, you can extract session info from the token
            if (credentials.startsWith("Bearer ")) {
                String jwtToken = credentials.substring(7);
                return extractSessionIdFromJWT(jwtToken);
            }
        }
        
        return null;
    } catch (Exception e) {
        log.debug("Could not extract session token from JWT: {}", e.getMessage());
        return null;
    }
}

private String extractSessionIdFromJWT(String jwtToken) {
    try {
        // Decode JWT token and extract session information
        // This depends on your JWT library (e.g., io.jsonwebtoken.Jwts)
        // Example with jjwt library:
        
        // Claims claims = Jwts.parser()
        //     .setSigningKey(secretKey)
        //     .parseClaimsJws(jwtToken)
        //     .getBody();
        // 
        // return claims.get("sessionId", String.class);
        
        return generateSessionIdFromToken(jwtToken);
    } catch (Exception e) {
        log.debug("Could not extract session ID from JWT: {}", e.getMessage());
        return null;
    }
}

private String generateSessionIdFromToken(String token) {
    // Generate a consistent session ID from the token
    return "session_" + Integer.toHexString(token.hashCode());
}
```

### 2. HTTP Request-Based Session Extraction

```java
private String extractSessionToken() {
    try {
        // Get current HTTP request
        RequestAttributes requestAttributes = RequestContextHolder.getRequestAttributes();
        if (requestAttributes instanceof ServletRequestAttributes) {
            HttpServletRequest request = ((ServletRequestAttributes) requestAttributes).getRequest();
            
            // Option 1: Extract from custom header
            String sessionToken = request.getHeader("X-Session-Token");
            if (sessionToken != null) {
                return sessionToken;
            }
            
            // Option 2: Extract from Authorization header
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                return generateSessionIdFromToken(authHeader.substring(7));
            }
            
            // Option 3: Extract from HTTP session
            HttpSession session = request.getSession(false);
            if (session != null) {
                return session.getId();
            }
        }
        
        return null;
    } catch (Exception e) {
        log.debug("Could not extract session token from request: {}", e.getMessage());
        return null;
    }
}
```

### 3. Spring Session Integration

```java
@Autowired
private SessionRepository sessionRepository; // If using Spring Session

private String extractSessionToken() {
    try {
        // Get current session from Spring Session
        RequestAttributes requestAttributes = RequestContextHolder.getRequestAttributes();
        if (requestAttributes instanceof ServletRequestAttributes) {
            HttpServletRequest request = ((ServletRequestAttributes) requestAttributes).getRequest();
            
            // Extract session ID from Spring Session
            String sessionId = request.getRequestedSessionId();
            if (sessionId != null) {
                return sessionId;
            }
            
            // Alternative: Extract from session cookie
            Cookie[] cookies = request.getCookies();
            if (cookies != null) {
                for (Cookie cookie : cookies) {
                    if ("SESSION".equals(cookie.getName())) {
                        return cookie.getValue();
                    }
                }
            }
        }
        
        return null;
    } catch (Exception e) {
        log.debug("Could not extract session token from Spring Session: {}", e.getMessage());
        return null;
    }
}
```

### 4. Custom Authentication Context

```java
private String extractSessionToken() {
    try {
        // If you have a custom user details with session info
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        
        if (authentication != null && authentication.getPrincipal() instanceof CustomUserDetails) {
            CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
            
            // If your CustomUserDetails has session information
            // return userDetails.getSessionToken();
        }
        
        // Alternative: Extract from authentication details
        if (authentication != null && authentication.getDetails() instanceof WebAuthenticationDetails) {
            WebAuthenticationDetails details = (WebAuthenticationDetails) authentication.getDetails();
            String sessionId = details.getSessionId();
            return sessionId;
        }
        
        return null;
    } catch (Exception e) {
        log.debug("Could not extract session token from authentication context: {}", e.getMessage());
        return null;
    }
}
```

### 5. Redis Session-Based Extraction

```java
@Autowired
private RedisTemplate<String, Object> redisTemplate; // If using Redis sessions

private String extractSessionToken() {
    try {
        // Extract user identifier
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null) {
            String username = authentication.getName();
            
            // Look up active session in Redis
            String sessionKey = "user_session:" + username;
            String sessionId = (String) redisTemplate.opsForValue().get(sessionKey);
            
            return sessionId;
        }
        
        return null;
    } catch (Exception e) {
        log.debug("Could not extract session token from Redis: {}", e.getMessage());
        return null;
    }
}
```

## Service-Specific Implementations

### Assessment Service
```java
// Add these dependencies to your service if needed
@Autowired
private HttpServletRequest request; // For accessing HTTP request directly

@Override
public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
    // ... existing code ...
    
    // Extract session token - choose implementation based on your auth strategy
    String sessionToken = extractSessionToken();
    
    // Rest of the implementation...
}

private String extractSessionToken() {
    // Choose one of the implementations above based on your authentication strategy
    // For most cases, JWT or HTTP request-based extraction works well
    
    try {
        RequestAttributes requestAttributes = RequestContextHolder.getRequestAttributes();
        if (requestAttributes instanceof ServletRequestAttributes) {
            HttpServletRequest request = ((ServletRequestAttributes) requestAttributes).getRequest();
            
            // Extract from Authorization header (most common)
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                return generateSessionIdFromToken(authHeader.substring(7));
            }
            
            // Fallback to HTTP session
            HttpSession session = request.getSession(false);
            if (session != null) {
                return session.getId();
            }
        }
        
        return null;
    } catch (Exception e) {
        log.debug("Could not extract session token: {}", e.getMessage());
        return null;
    }
}

private String generateSessionIdFromToken(String token) {
    // Generate consistent session ID from JWT token
    return "session_" + Integer.toHexString(token.hashCode());
}
```

## Required Dependencies

### For JWT Token Extraction
```xml
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.11.5</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.11.5</version>
    <scope>runtime</scope>
</dependency>
```

### For Spring Session
```xml
<dependency>
    <groupId>org.springframework.session</groupId>
    <artifactId>spring-session-core</artifactId>
</dependency>
```

### For Redis Session
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.session</groupId>
    <artifactId>spring-session-data-redis</artifactId>
</dependency>
```

## Configuration Examples

### Application Properties for Session Management
```properties
# For Spring Session with Redis
spring.session.store-type=redis
spring.redis.host=localhost
spring.redis.port=6379

# For JWT configuration
app.jwt.secret=mySecretKey
app.jwt.expiration=86400000

# For session timeout
server.servlet.session.timeout=30m
```

## Testing Session Token Extraction

```java
@Test
public void testSessionTokenExtraction() {
    // Mock authentication context
    Authentication auth = mock(Authentication.class);
    when(auth.getCredentials()).thenReturn("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...");
    
    SecurityContext securityContext = mock(SecurityContext.class);
    when(securityContext.getAuthentication()).thenReturn(auth);
    SecurityContextHolder.setContext(securityContext);
    
    // Test extraction
    String sessionToken = userDetailsService.extractSessionToken();
    assertNotNull(sessionToken);
    assertTrue(sessionToken.startsWith("session_"));
}
```

## Best Practices

1. **Choose Based on Architecture**: Select the extraction method that aligns with your authentication architecture
2. **Graceful Degradation**: Always return null if session token can't be extracted
3. **Consistent Generation**: Use consistent algorithms for generating session IDs from tokens
4. **Performance**: Cache session lookups when possible
5. **Security**: Never log actual session tokens, only their presence/absence
6. **Testing**: Include unit tests for session extraction logic

## Implementation Priority

1. **Start Simple**: Begin with basic JWT or HTTP session extraction
2. **Enhance Gradually**: Add more sophisticated extraction as needed
3. **Monitor Usage**: Use analytics to see which extraction methods are most effective
4. **Optimize**: Optimize based on actual usage patterns

This approach ensures that user activity tracking works immediately with basic session identification while allowing for enhanced session management as your authentication system evolves. 