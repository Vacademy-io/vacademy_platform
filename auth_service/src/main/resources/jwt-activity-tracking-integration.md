# JWT Authentication Filter Integration with Activity Tracking

## Overview
This document explains how JWT authentication filters have been enhanced to provide comprehensive user activity tracking and session management integration.

## Integration Architecture

### 1. JWT Filter Enhancement
Both `JwtAuthFilter` and `AssessmentJwtAuthFilter` have been enhanced to:

- **Extract session tokens** from JWT tokens for consistent session tracking
- **Set request attributes** that UserDetailsService implementations can access
- **Track authentication activities** directly in the filter
- **Create and update user sessions** for real-time monitoring

### 2. Request Attribute Flow

```
JWT Filter → Set Request Attributes → UserDetailsService → Auth Service API Call
```

**Request Attributes Set by JWT Filters:**
- `serviceName`: The name of the calling service (e.g., "assessment-service")
- `sessionToken`: Generated from JWT token hash for session consistency

### 3. Activity Tracking Points

#### A. JWT Filter Level (Direct Tracking)
```java
// In JWT filters after successful authentication
userActivityTrackingService.logUserActivity(
    userDetails.getUserId(),
    instituteId,
    serviceName,
    endpoint,
    "JWT_AUTHENTICATION", 
    sessionToken,
    ipAddress,
    userAgent,
    200,
    responseTime
);

// Session creation/update
userActivityTrackingService.createOrUpdateSession(
    userDetails.getUserId(),
    instituteId,
    sessionToken,
    ipAddress,
    userAgent
);
```

#### B. UserDetailsService Level (Auth Service API Calls)
```java
// When UserDetailsService calls auth service
String endpoint = AuthConstant.userServiceRoute 
    + "?userName=" + username 
    + "&serviceName=" + clientName
    + "&sessionToken=" + sessionToken;
```

## Session Token Generation

### JWT-Based Session Tokens
```java
private String generateSessionIdFromJwt(String jwt) {
    return "jwt_session_" + Integer.toHexString(jwt.hashCode());
}
```

**Benefits:**
- **Consistent**: Same JWT always generates same session ID
- **Unique**: Different JWTs generate different session IDs
- **Lightweight**: No additional storage required
- **Stateless**: Fits with JWT stateless architecture

## Enhanced UserDetailsService Implementation

### Session Token Extraction Strategy
```java
private String extractSessionToken() {
    try {
        // 1. Check request attributes (set by JWT filter)
        RequestAttributes requestAttributes = RequestContextHolder.getRequestAttributes();
        if (requestAttributes instanceof ServletRequestAttributes) {
            HttpServletRequest request = ((ServletRequestAttributes) requestAttributes).getRequest();
            
            // Priority 1: JWT filter-set session token
            String sessionToken = (String) request.getAttribute("sessionToken");
            if (sessionToken != null) {
                return sessionToken;
            }
            
            // Priority 2: Extract from Authorization header
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                return generateSessionIdFromToken(authHeader.substring(7));
            }
            
            // Priority 3: HTTP session fallback
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
```

## Activity Tracking Coverage

### 1. JWT Authentication Flow
```
User Request → JWT Filter → UserDetailsService → Auth Service → Analytics
     ↓              ↓             ↓                ↓            ↓
IP, Device → Session Token → Service Name → Activity Log → Dashboard
```

### 2. What Gets Tracked

#### At JWT Filter Level:
- **Authentication attempts** (successful/failed)
- **Session creation/updates**
- **Request endpoints**
- **Response times**
- **Device information**
- **IP addresses**

#### At Auth Service Level:
- **User verification calls**
- **Service-specific usage**
- **Cross-service user journeys**
- **API response times**

## Real-Time Analytics Benefits

### 1. Live Session Monitoring
- **Currently active users** across all services
- **Real-time session durations**
- **Active service usage**
- **Device and location tracking**

### 2. Service-Specific Insights
- **Assessment service**: Track test-taking patterns
- **Admin core service**: Monitor administrative activities  
- **Media service**: Track content consumption
- **Community service**: Monitor engagement patterns
- **Notification service**: Track notification interactions

### 3. User Journey Tracking
```json
{
  "user_id": "12345",
  "username": "john.doe", 
  "session_journey": [
    {"time": "09:00", "service": "admin-core-service", "action": "LOGIN"},
    {"time": "09:15", "service": "assessment-service", "action": "VIEW_TESTS"},
    {"time": "09:30", "service": "media-service", "action": "UPLOAD_CONTENT"},
    {"time": "10:00", "service": "community-service", "action": "POST_MESSAGE"}
  ]
}
```

## Service-Specific Configurations

### Assessment Service
```properties
spring.application.name=assessment-service
```
- **JWT Filter**: `AssessmentJwtAuthFilter` with special handling for assessment-specific endpoints
- **Dual UserDetailsService**: Uses both regular and assessment-internal user details services
- **Activity Tracking**: Tracks test attempts, submissions, and grading activities

### Admin Core Service  
```properties
spring.application.name=admin-core-service
```
- **Activity Tracking**: Tracks administrative actions, user management, and system configurations

### Media Service
```properties
spring.application.name=media-service
```
- **Activity Tracking**: Tracks file uploads, downloads, and media consumption

### Community Service
```properties
spring.application.name=community-service
```
- **Activity Tracking**: Tracks posts, comments, and social interactions

### Notification Service
```properties
spring.application.name=notification-service
```
- **Activity Tracking**: Tracks notification deliveries and user interactions

## Error Handling and Graceful Degradation

### 1. Optional Dependencies
```java
@Autowired(required = false)
private UserActivityTrackingService userActivityTrackingService;
```

### 2. Exception Handling
```java
try {
    // Activity tracking code
} catch (Exception e) {
    log.debug("Error tracking activity: {}", e.getMessage());
    // Continue with normal authentication flow
}
```

### 3. Fallback Mechanisms
- If `UserActivityTrackingService` is not available, authentication continues normally
- If session token extraction fails, uses `null` (graceful degradation)
- If analytics DB is down, user authentication is not affected

## Performance Considerations

### 1. Asynchronous Processing
- **Activity logging** is asynchronous (doesn't block authentication)
- **Session updates** are asynchronous
- **Analytics calculations** happen in background

### 2. Minimal Overhead
- **Session token generation**: Simple hash operation
- **Request attributes**: No additional network calls
- **Graceful degradation**: No performance impact if analytics service is unavailable

### 3. Efficient Session Management
- **JWT-based sessions**: No additional storage required
- **Consistent session IDs**: Same JWT = same session ID
- **Automatic cleanup**: Inactive sessions are automatically cleaned up

## Monitoring and Observability

### 1. Log Messages
```
DEBUG: Could not extract session token: {reason}
DEBUG: Error tracking JWT authentication activity: {error}
INFO: User Authenticated Successfully...!!!
```

### 2. Metrics Available
- **Authentication success/failure rates**
- **Session duration averages**
- **Service usage patterns**
- **Peak activity times**
- **Device distribution**

### 3. Health Checks
- Monitor activity tracking service availability
- Track analytics database connectivity
- Monitor session cleanup processes

## Security Considerations

### 1. Session Token Security
- **Hash-based generation**: Prevents token guessing
- **No sensitive data**: Session tokens contain no personal information
- **Consistent generation**: Same input always produces same output

### 2. Privacy Protection
- **IP address handling**: Properly handled for privacy compliance
- **User agent parsing**: Device info extraction without fingerprinting
- **Data retention**: Configurable retention policies

### 3. Access Control
- **Analytics APIs**: Require proper authentication
- **Institute-based filtering**: Users can only see their institute's data
- **Role-based access**: Different roles see different analytics levels

## Deployment and Configuration

### 1. Required Properties
```properties
# Service identification
spring.application.name=${SERVICE_NAME}

# Auth service URL
auth.server.baseurl=${AUTH_SERVICE_URL}
```

### 2. Optional Properties
```properties
# Activity tracking (optional)
analytics.tracking.enabled=true
analytics.session.timeout=30m
analytics.cleanup.inactive-sessions=2h
```

### 3. Database Migrations
Ensure the following tables exist:
- `user_activity_log`
- `user_session` 
- `daily_user_activity_summary`

## Testing and Validation

### 1. Integration Testing
```java
@Test
public void testJwtAuthenticationWithActivityTracking() {
    // Test JWT authentication
    // Verify activity logging
    // Check session creation
    // Validate analytics data
}
```

### 2. Activity Verification
- Check activity logs after authentication
- Verify session creation in database
- Validate analytics API responses
- Test graceful degradation scenarios

This comprehensive integration ensures that every JWT authentication automatically contributes to the user activity analytics while maintaining system performance and reliability. 