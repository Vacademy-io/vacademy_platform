# Sentry Logging Implementation Plan

## Overview
This document outlines the implementation plan for adding Sentry structured logs throughout the Vacademy platform's Spring Boot services.

## Current Status
✅ Sentry is already configured in all services with:
- `sentry.logs.enabled=true`
- `sentry.dsn=${SENTRY_DSN}`
- `sentry.send-default-pii=true`
- `sentry.traces-sample-rate=1.0`
- `sentry.enable-tracing=true`

## Implementation Strategy

### 1. Add Sentry Logging to All Error/Exception Handlers

We will add `Sentry.logger()` calls in the following locations:

#### A. Catch Blocks
- Add `Sentry.logger().error()` alongside existing `log.error()` calls
- Include relevant context attributes for better debugging

#### B. Before Throwing Exceptions
- Log critical errors before throwing exceptions
- Capture error context and metadata

### 2. Logging Patterns

**Note:** The current Sentry SDK version (7.15.0) does not support the newer `Sentry.logger()` API. We're using `SentryEvent` API and have created a `SentryLogger` utility class for easier usage.

#### Pattern 1: Simple Error Logging (Using Utility)
```java
import vacademy.io.common.logging.SentryLogger;

catch (Exception e) {
    log.error("Error occurred", e);
    SentryLogger.logError(e, "Error occurred: " + e.getMessage());
    throw new VacademyException(e.getMessage());
}
```

#### Pattern 2: Error with Context (Using Utility)
```java
import vacademy.io.common.logging.SentryLogger;
import java.util.Map;

catch (Exception e) {
    log.error("Error processing user {}", userId, e);
    SentryLogger.logError(e, "Error processing user: " + e.getMessage(), Map.of(
        "user.id", userId.toString(),
        "operation", "processUser"
    ));
    throw new VacademyException(e.getMessage());
}
```

#### Pattern 3: Error with Builder Pattern
```java
import vacademy.io.common.logging.SentryLogger;

catch (Exception e) {
    log.error("Payment processing failed for user {}", userId, e);
    SentryLogger.SentryEventBuilder.error(e)
        .withMessage("Payment processing failed: " + e.getMessage())
        .withTag("user.id", userId.toString())
        .withTag("payment.id", paymentId.toString())
        .withTag("payment.gateway", gateway)
        .withTag("operation", "processPayment")
        .send();
    throw new PaymentException("Payment processing failed", e);
}
```

#### Pattern 4: Warning/Critical Scenarios
```java
import vacademy.io.common.logging.SentryLogger;

if (criticalConditionFailed) {
    log.warn("Critical condition failed for {}", entityId);
    SentryLogger.logWarning("Critical condition failed for entity: " + entityId, Map.of(
        "entity.id", entityId.toString(),
        "entity.type", "Package"
    ));
}
```

#### Pattern 5: Direct SentryEvent Usage (When Needed)
```java
import io.sentry.Sentry;
import io.sentry.SentryEvent;
import io.sentry.SentryLevel;
import io.sentry.protocol.Message;

catch (Exception e) {
    log.error("Error occurred", e);
    SentryEvent event = new SentryEvent(e);
    event.setLevel(SentryLevel.ERROR);
    Message message = new Message();
    message.setMessage("Error occurred: " + e.getMessage());
    event.setMessage(message);
    event.setTag("operation", "someOperation");
    Sentry.captureEvent(event);
    throw new VacademyException(e.getMessage());
}
```

### 3. Services to Update

All services across the platform:
- `admin_core_service`
- `auth_service`
- `assessment_service`
- `media_service`
- `community_service`
- `notification_service`
- `common_service`

### 4. Priority Areas

#### High Priority (Critical Business Logic):
1. Authentication and authorization errors
2. Payment processing errors
3. User enrollment errors
4. LLM/AI service failures
5. External API integration failures

#### Medium Priority:
1. Data validation errors
2. Service-to-service communication errors
3. Database operation failures
4. File upload/processing errors

#### Low Priority:
1. Parsing errors (non-critical)
2. Cache misses
3. Optional feature failures

## Default Attributes

All Sentry logs automatically include:
- `environment` - set from SDK configuration
- `release` - set from SDK configuration
- `sdk.name` and `sdk.version`
- `server.address`
- User attributes (if available): `user.id`, `user.name`, `user.email`

## Custom Attributes to Add

For better debugging, add these custom attributes where relevant:

### Common Attributes:
- `institute.id` - Institute identifier
- `user.id` - User identifier
- `operation` - Operation being performed
- `entity.type` - Type of entity (e.g., "Enrollment", "Payment", "Course")
- `entity.id` - Entity identifier
- `error.type` - Type of error
- `request.id` - Request trace ID

### Service-Specific Attributes:

**Auth Service:**
- `auth.method` - Authentication method used
- `auth.provider` - OAuth provider (if applicable)

**Admin Core Service:**
- `package.id`, `session.id`
- `workflow.id`, `workflow.execution.id`
- `llm.model` - LLM model being used

**Payment/Subscription:**
- `payment.method`
- `payment.gateway`
- `subscription.id`

## Implementation Checklist

### Phase 1: Setup (✅ Complete)
- [x] Verify Sentry is configured in all services
- [x] Confirm `sentry.logs.enabled=true` in all application.properties

### Phase 2: Core Services
- [ ] Add Sentry logging to `admin_core_service`
  - [ ] InstructorCopilotLLMService
  - [ ] Enrollment services
  - [ ] Package services
  - [ ] Workflow engine
  - [ ] Payment services
  - [ ] Report services
  
- [ ] Add Sentry logging to `auth_service`
  - [ ] Authentication managers
  - [ ] OAuth handlers
  - [ ] User services
  - [ ] Permission services

- [ ] Add Sentry logging to `common_service`
  - [ ] FileService
  - [ ] External API clients

### Phase 3: Supporting Services
- [ ] Add Sentry logging to `assessment_service`
- [ ] Add Sentry logging to `media_service`
- [ ] Add Sentry logging to `community_service`
- [ ] Add Sentry logging to `notification_service`

### Phase 4: Testing & Validation
- [ ] Test Sentry logs appear in Sentry dashboard
- [ ] Verify attributes are correctly set
- [ ] Ensure no performance degradation
- [ ] Review log volume and adjust sampling if needed

## Example Implementations

### Example 1: LLM Service Error
```java
.onErrorResume(e -> {
    log.warn("Model xiaomi/mimo-v2-flash:free failed, retrying with mistralai/devstral-2512:free", e);
    Sentry.logger().log(
        SentryLogLevel.WARN,
        SentryLogParameters.create(
            SentryAttributes.of(
                SentryAttribute.stringAttribute("llm.model", "xiaomi/mimo-v2-flash:free"),
                SentryAttribute.stringAttribute("operation", "generateContentFromTranscript"),
                SentryAttribute.stringAttribute("fallback.model", "mistralai/devstral-2512:free")
            )
        ),
        "LLM model failed, attempting fallback: %s",
        e.getMessage()
    );
    return callModel("mistralai/devstral-2512:free", prompt, 2);
})
```

### Example 2: Payment Processing Error
```java
catch (Exception e) {
    log.error("Payment processing failed for user {}", userId, e);
    Sentry.logger().log(
        SentryLogLevel.ERROR,
        SentryLogParameters.create(
            SentryAttributes.of(
                SentryAttribute.stringAttribute("user.id", userId.toString()),
                SentryAttribute.stringAttribute("payment.id", paymentId.toString()),
                SentryAttribute.stringAttribute("payment.gateway", gateway),
                SentryAttribute.stringAttribute("operation", "processPayment")
            )
        ),
        "Payment processing failed: %s",
        e.getMessage()
    );
    throw new PaymentException("Payment processing failed", e);
}
```

### Example 3: Authentication Error
```java
if (user == null) {
    log.error("User not found for email: {}", email);
    Sentry.logger().log(
        SentryLogLevel.ERROR,
        SentryLogParameters.create(
            SentryAttributes.of(
                SentryAttribute.stringAttribute("auth.email", email),
                SentryAttribute.stringAttribute("auth.method", "password"),
                SentryAttribute.stringAttribute("operation", "login")
            )
        ),
        "User not found for email during login"
    );
    throw new UsernameNotFoundException("User not found");
}
```

## Best Practices

1. **Always log before throwing**: Add Sentry logging before throwing custom exceptions
2. **Use appropriate log levels**:
   - `FATAL` - System-critical failures
   - `ERROR` - Operation failures that need attention
   - `WARN` - Degraded functionality or fallback scenarios
   - `INFO` - Important state changes
   
3. **Add meaningful attributes**: Include context that helps debug the issue
4. **Avoid logging sensitive data**: Even though `send-default-pii=true`, be cautious with passwords, tokens, etc.
5. **Use formatted messages**: Use `%s` placeholders for better searchability
6. **Consistent attribute naming**: Follow the naming conventions defined above

## Performance Considerations

- Sentry logging is asynchronous and shouldn't impact performance significantly
- If log volume is too high in production, consider:
  - Reducing `traces-sample-rate` from 1.0 to 0.1-0.5
  - Using `beforeSendLog` callback to filter non-critical logs
  - Adjusting log levels (e.g., only ERROR and FATAL in production)

## Monitoring

After implementation:
1. Monitor Sentry dashboard for new logs
2. Create alerts for critical error patterns
3. Review log volume and adjust configuration
4. Set up dashboards for key metrics (error rates by service, user, operation)

## Next Steps

1. Start with high-priority services (auth, payments, enrollments)
2. Add Sentry logging to all catch blocks and error scenarios
3. Test in lower environments (dev, stage)
4. Monitor and adjust before production rollout
5. Document any issues or patterns discovered
