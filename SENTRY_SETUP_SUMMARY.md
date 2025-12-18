# Sentry Logging Setup - Summary

## ✅ Completed Steps

### 1. Configuration Verification
- All services already have `sentry.logs.enabled=true` in application.properties
- Sentry DSN configured via environment variable `${SENTRY_DSN}`
- SDK version: 7.15.0 (compatible with SentryEvent API)

### 2. Created Utility Class
Created `SentryLogger` utility in `common_service/src/main/java/vacademy/io/common/logging/SentryLogger.java`

This utility provides:
- **Simple error logging**: `SentryLogger.logError(exception, message)`  
- **Error logging with context**: `SentryLogger.logError(exception, message, tags)`
- **Warning logging**: `SentryLogger.logWarning(message, tags)`
- **Builder pattern** for complex events: `SentryLogger.SentryEventBuilder.error(e).withTag(...).send()`

### 3. Added Dependencies
- Added Sentry dependency to `common_service/pom.xml` (version 7.15.0)
- All other services already had Sentry dependencies configured

### 4. Implemented Sentry Logging in Admin Core Service

#### A. LLM Services
- ✅ `InstructorCopilotLLMService.java` - LLM model failures and fallbacks
  - Model failure warnings with fallback context
  - Parsing error logging
  - Missing content node errors

#### B. Workflow Engine (Complete Implementation)
- ✅ `WorkflowTriggerService.java` - Trigger execution failures
  - Individual workflow execution failures
  - Unexpected trigger event processing errors
  
- ✅ `WorkflowExecutionLogger.java` - Execution logging failures
  - Serialization failures (input context, skip reason, progress, details)
  - Node execution logging errors
  - JSON parsing errors

- ✅ `SendWhatsAppNodeHandler.java` - WhatsApp node errors
  - Failed to build WhatsApp request
  - Batch send failures
  - forEach operation errors
  - Template parameter parsing failures

- ✅ `WorkflowScheduleService.java` - Schedule management errors
  - Active schedule retrieval failures
  - Due schedule retrieval failures
  - Schedule CRUD operation failures

**Tags Used in Workflows:**
- `workflow.id`, `workflow.execution.id`, `trigger.id`, `trigger.event`
- `node.id`, `node.template.id`, `node.type`
- `schedule.id`, `schedule.type`
- `batch.count`, `user.count`, `template.name`
- `institute.id`, `operation`

See `SENTRY_WORKFLOW_LOGGING_SUMMARY.md` for complete workflow logging documentation.

## 📋 Usage Examples

### Example 1: Simple Error Logging
```java
import vacademy.io.common.logging.SentryLogger;

try {
    // some operation
} catch (Exception e) {
    log.error("Error occurred", e);
    SentryLogger.logError(e, "Failed to process operation: " + e.getMessage());
    throw new VacademyException(e.getMessage());
}
```

### Example 2: Error with Contextual Tags
```java
import vacademy.io.common.logging.SentryLogger;
import java.util.Map;

try {
    // payment processing
} catch (PaymentException e) {
    log.error("Payment failed for user {}", userId, e);
    SentryLogger.logError(e, "Payment processing failed", Map.of(
        "user.id", userId.toString(),
        "payment.id", paymentId.toString(),
        "payment.gateway", gateway,
        "operation", "processPayment"
    ));
    throw e;
}
```

### Example 3: Using Builder Pattern
```java
import vacademy.io.common.logging.SentryLogger;

try {
    enrollStudent(studentId, packageId);
} catch (EnrollmentException e) {
    log.error("Enrollment failed", e);
    SentryLogger.SentryEventBuilder.error(e)
        .withMessage("Student enrollment failed: " + e.getMessage())
        .withTag("student.id", studentId.toString())
        .withTag("package.id", packageId.toString())
        .withTag("institute.id", instituteId.toString())
        .withTag("operation", "enrollStudent")
        .withTag("error.type", e.getClass().getSimpleName())
        .send();
    throw e;
}
```

### Example 4: Warning for Non-Critical Issues
```java
import vacademy.io.common.logging.SentryLogger;

if (userNotFound) {
    log.warn("User not found for email: {}", email);
    SentryLogger.logWarning("User lookup failed during enrollment", Map.of(
        "email.domain", extractDomain(email),
        "operation", "enrollmentLookup",
        "institute.id", instituteId.toString()
    ));
    return Optional.empty();
}
```

### Example 5: LLM/External Service Failures (with Fallback)
```java
import vacademy.io.common.logging.SentryLogger;

.onErrorResume(e -> {
    log.warn("Primary service failed, attempting fallback", e);
    SentryLogger.SentryEventBuilder.warning(e)
        .withMessage("Service failed, using fallback: " + e.getMessage())
        .withTag("service", "primaryService")
        .withTag("fallback", "secondaryService")
        .withTag("operation", "dataFetch")
        .send();
    return callFallbackService();
})
```

### Example 6: Authentication/Authorization Errors
```java
import vacademy.io.common.logging.SentryLogger;

if (user == null) {
    log.error("Authentication failed for email: {}", email);
    UsernameNotFoundException exception = new UsernameNotFoundException("User not found");
    SentryLogger.logError(exception, "Authentication failed", Map.of(
        "auth.method", "password",
        "operation", "login",
        "email.domain", extractDomain(email)
    ));
    throw exception;
}
```

## 🎯 Next Steps

### High Priority Areas (To be Implemented)

1. **Authentication & Authorization**
   - ✅ Example provided above
   - Files: `AuthManager.java`, `LearnerAuthManager.java`, `AdminOAuth2Manager.java`
   
2. **Payment Processing**
   - ✅ Example provided above  
   - Files: `PaymentLogService.java`, payment gateway handlers

3. **User Enrollment**
   - ✅ Example provided above
   - Files: `EnrollmentService.java`, `LearnerEnrollRequestService.java`

4. **External API Integrations**
   - Files: Various service clients making HTTP calls
   - Pattern: Add Sentry logging in `.onErrorResume()` blocks

5. **File Processing**
   - Files: `FileService.java`, media processing services
   - Pattern: Log errors with file metadata (size, type, operation)

6. **Workflow Engine**
   - Files: `WorkflowExecutionLogger.java`, node handlers
   - Pattern: Log with workflow.id, node.id, execution.id tags

### Implementation Workflow

For each service/feature:

1. **Identify error scenarios**
   ```bash
   # Search for catch blocks
   grep -rn "catch" --include="*.java" service_name/
   
   # Search for throw statements
   grep -rn "throw new" --include="*.java" service_name/
   ```

2. **Add Sentry logging**
   - Import `vacademy.io.common.logging.SentryLogger`
   - Add logging call before/after throw or in catch block
   - Include relevant contextual tags

3. **Test the integration**
   - Trigger the error scenario
   - Verify event appears in Sentry dashboard
   - Check tags and context are correctly set
   
4. **Update documentation**
   - Add entry to this file
   - Update `SENTRY_LOGGING_IMPLEMENTATION.md` checklist

## 📊 Recommended Tags

### Common Tags for All Services
- `operation` - Operation being performed (e.g., "enrollStudent", "processPayment")
- `error.type` - Exception class name
- `service.name` - Name of the microservice

### Entity-Specific Tags
- `user.id` - User identifier  
- `institute.id` - Institute identifier
- `package.id` - Package identifier
- `session.id` - Session identifier
- `payment.id` - Payment identifier
- `workflow.id` - Workflow identifier
- `course.id` - Course identifier

### Operation-Specific Tags
- `auth.method` - Authentication method (password, oauth2, otp)
- `auth.provider` - OAuth provider (google, microsoft, etc.)
- `payment.gateway` - Payment gateway (stripe, razorpay)
- `llm.model` - LLM model being used  
- `file.type` - File type being processed
- `api.endpoint` - External API endpoint

## 🔍 Monitoring in Sentry

After implementation:

1. **View Logs in Sentry Dashboard**
   - Go to your Sentry project
   - Navigate to "Issues" to see errors
   - Use tags to filter (e.g., `operation:enrollStudent`)

2. **Create Alerts**
   - Set up alerts for critical operations
   - Alert on error rate thresholds
   - Alert on specific error types

3. **Analyze Trends**
   - Track error rates over time
   - Identify problematic operations
   - Monitor fallback usage rates

## 🚀 Quick Start Guide

To add Sentry logging to a new file:

1. **Add the import:**
   ```java
   import vacademy.io.common.logging.SentryLogger;
   ```

2. **In your catch block:**
   ```java
   catch (Exception e) {
       log.error("Operation failed", e);
       SentryLogger.logError(e, "Descriptive message", Map.of(
           "tag1", "value1",
           "tag2", "value2"
       ));
       // handle or rethrow
   }
   ```

3. **Or use the builder for complex scenarios:**
   ```java
   SentryLogger.SentryEventBuilder.error(exception)
       .withMessage("Detailed error message")
       .withTag("key1", "value1")
       .withTag("key2", "value2")
       .send();
   ```

## ⚠️ Important Notes

1. **Don't log sensitive data** in messages or tags (passwords, tokens, credit cards)
2. **Use consistent tag names** across services (see Recommended Tags section)
3. **Keep messages descriptive** but concise
4. **Always use try-catch** around Sentry calls in utility methods (already handled in SentryLogger)
5. **Test in lower environments** before production

## 📝 Files Modified

1. `/common_service/src/main/java/vacademy/io/common/logging/SentryLogger.java` - ✅ Created
2. `/common_service/pom.xml` - ✅ Added Sentry dependency
3. `/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/instructor_copilot/service/InstructorCopilotLLMService.java` - ✅ Added logging
4. `/SENTRY_LOGGING_IMPLEMENTATION.md` - ✅ Implementation plan
5. `/SENTRY_SETUP_SUMMARY.md` - ✅ This file

## ✨ Benefits

- **Centralized error tracking** across all microservices
- **Rich context** with tags for debugging
- **Automatic correlation** with traces and user sessions
- **Easy filtering** and searching in Sentry UI
- **Proactive monitoring** via alerts
- **Better debugging** with full stack traces and context
