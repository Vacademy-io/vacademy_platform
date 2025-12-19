# Activity Logging Optimization Summary

## Objective
Ensure activity logging runs only in the **auth service** and executes **asynchronously** to prevent blocking request threads.

## Changes Made

### 1. UserActivityTrackingService.java
**Location:** `common_service/src/main/java/vacademy/io/common/auth/service/UserActivityTrackingService.java`

#### Changes:
- **Made `createOrUpdateSession()` async**: Added `@Async` annotation (line 91)
- **Added auth service check**: Added `shouldLogActivity()` check at the beginning of the method (lines 95-97)
- **Changed return type**: Changed from `UserSession` to `void` since async methods cannot return values
- **Improved error handling**: Added proper error logging instead of silent failure

#### Before:
```java
@Transactional
public UserSession createOrUpdateSession(...) {
    try {
        // ... logic
        return sessionRepository.save(newSession);
    } catch (Exception e) {
    }
    return null;
}
```

#### After:
```java
@Async
@Transactional
public void createOrUpdateSession(...) {
    if (!shouldLogActivity()) {
        return;
    }
    try {
        // ... logic
        sessionRepository.save(newSession);
    } catch (Exception e) {
        log.error("Error creating or updating user session", e);
    }
}
```

### 2. JwtAuthFilter.java
**Location:** `common_service/src/main/java/vacademy/io/common/auth/filter/JwtAuthFilter.java`

#### Changes:
- **Removed unused method**: Deleted the `addUserActivity()` method that was not being used (lines 155-166)
- **Removed unused dependencies**: 
  - Removed `@Autowired UserActivityRepository` field
  - Removed import for `UserActivity` entity
  - Removed import for `UserActivityRepository`

## How It Works Now

### Service-Specific Execution
The `shouldLogActivity()` method checks if the current service is the auth service:

```java
private boolean shouldLogActivity() {
    if (applicationName == null || applicationName.trim().isEmpty()) {
        return false;
    }
    return AUTH_SERVICE_NAME.equalsIgnoreCase(applicationName.trim());
}
```

Where `AUTH_SERVICE_NAME = "auth_service"` and `applicationName` comes from `${spring.application.name}`.

### Async Execution Flow

1. **Request arrives** at JwtAuthFilter
2. **JWT is validated** and user is authenticated (synchronous)
3. **Activity logging is triggered** (non-blocking):
   ```java
   userActivityTrackingService.logUserActivity(...);  // @Async
   userActivityTrackingService.createOrUpdateSession(...);  // @Async
   ```
4. **Request proceeds** immediately without waiting for DB writes
5. **In parallel**, the async methods execute in a separate thread pool

### Async Configuration
The auth service has async execution properly configured:

**AsyncConfiguration.java:**
- Core pool size: 5 threads
- Max pool size: 20 threads
- Queue capacity: 500 tasks
- Thread name prefix: "AuthAsync-"
- Rejection policy: CallerRunsPolicy (falls back to caller thread if queue is full)

**Main Application:**
- `@EnableAsync` is enabled in `AuthServiceApplication.java`

## Benefits

✅ **No blocking**: Request threads are not blocked by database writes  
✅ **Better performance**: Activity logging happens in the background  
✅ **Service isolation**: Only auth service performs activity logging  
✅ **Resource efficiency**: Other services don't waste resources on unused activity tracking  
✅ **Cleaner code**: Removed unused/duplicate code  

## Testing Recommendations

1. **Verify async execution**:
   - Look for "AuthAsync-" threads in logs
   - Check that request response times are not affected by activity logging

2. **Verify service-specific execution**:
   - Confirm activity logs are only created when requests go through auth service
   - Verify other services (admin-core, notification, etc.) don't create activity logs

3. **Load testing**:
   - Test with high concurrent requests to ensure async thread pool handles the load
   - Monitor for any rejected tasks (should trigger CallerRunsPolicy)
