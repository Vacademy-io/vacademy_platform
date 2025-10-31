# SQS/SNS Disable Solution - Implementation Summary

## Problem
The notification service was failing to start when AWS SQS was not available or configured, with the error:
```
org.springframework.beans.factory.BeanCreationException: Error creating bean with name 'sqsAsyncClient'
...
The URI scheme of endpointOverride must not be null.
```

## Solution Overview
Implemented a comprehensive solution to conditionally enable/disable AWS SQS functionality based on the `AWS_SQS_ENABLED` environment variable (or `aws.sqs.enabled` property).

## Implementation Components

### 1. EnvironmentPostProcessor
**File:** `src/main/java/vacademy/io/notification_service/config/SqsAutoConfigurationExcluder.java`

- Runs early in Spring Boot lifecycle (before auto-configuration)
- Checks `aws.sqs.enabled` property
- Dynamically excludes `io.awspring.cloud.autoconfigure.sqs.SqsAutoConfiguration` when SQS is disabled
- Prevents Spring Cloud AWS from attempting to initialize SQS clients

### 2. Conditional Bean Configurations
**Files:**
- `src/main/java/vacademy/io/notification_service/config/AwsSqsConfig.java`
- `src/main/java/vacademy/io/notification_service/service/SqsEmailEventListener.java`

- Both annotated with `@ConditionalOnProperty(name = "aws.sqs.enabled", havingValue = "true", matchIfMissing = false)`
- Beans only created when SQS is explicitly enabled
- Prevents our custom SQS configurations from loading when disabled

### 3. EnvironmentPostProcessor Registration
**Files:**
- `src/main/resources/META-INF/spring.factories` (Spring Boot 2.x compatible)
- `src/main/resources/META-INF/spring/org.springframework.boot.env.EnvironmentPostProcessor.imports` (Spring Boot 3.x format)

Registers `SqsAutoConfigurationExcluder` to be executed during application startup.

### 4. Property File Configuration

#### Local Development (`application-k8s-local.properties`)
```properties
aws.sqs.enabled=false
spring.autoconfigure.exclude=io.awspring.cloud.autoconfigure.sqs.SqsAutoConfiguration
```

#### Test Environment (`application-test.properties`)
```properties
aws.sqs.enabled=false
spring.autoconfigure.exclude=io.awspring.cloud.autoconfigure.sqs.SqsAutoConfiguration
```

#### Stage/Production (`application-stage.properties`, `application-prod.properties`)
```properties
aws.sqs.enabled=${AWS_SQS_ENABLED:true}
```
Note: The EnvironmentPostProcessor handles exclusion automatically based on the property value.

### 5. GitHub Actions Integration
**File:** `.github/workflows/maven-publish-notification-service.yml`

Added `AWS_SQS_ENABLED` environment variable from GitHub secrets in:
- Build step (line 79)
- Deployment step (line 125)

## How It Works

### When `aws.sqs.enabled=false`:
1. `SqsAutoConfigurationExcluder` detects the setting during environment initialization
2. Adds `SqsAutoConfiguration` to Spring's auto-configuration exclusion list
3. Spring Cloud AWS SQS beans are never created
4. `AwsSqsConfig` is skipped (due to `@ConditionalOnProperty`)
5. `SqsEmailEventListener` is skipped (due to `@ConditionalOnProperty`)
6. Application starts successfully without AWS connectivity

### When `aws.sqs.enabled=true`:
1. `SqsAutoConfigurationExcluder` does nothing
2. Spring Cloud AWS SQS auto-configuration proceeds normally
3. `AwsSqsConfig` creates custom SQS client with credentials
4. `SqsEmailEventListener` starts listening to `vacademy-ses-events` queue
5. Email tracking events are processed from SQS

## Configuration by Environment

| Environment | aws.sqs.enabled | Auto-Exclusion | Behavior |
|-------------|-----------------|----------------|----------|
| Local K8s | false | Yes (explicit) | SQS disabled, no AWS needed |
| Test | false | Yes (explicit) | SQS disabled, tests run without AWS |
| Stage | Configurable (default: true) | Yes (dynamic) | Set `AWS_SQS_ENABLED` secret |
| Production | Configurable (default: true) | Yes (dynamic) | Set `AWS_SQS_ENABLED` secret |

## Usage

### For Local Development
No changes needed - SQS is automatically disabled.

### To Disable SQS in Stage/Production
1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Add/Update secret: `AWS_SQS_ENABLED=false`
3. Deploy the service

### To Enable SQS in Stage/Production
1. Ensure `AWS_SQS_ENABLED=true` (or remove the secret to use default)
2. Ensure all AWS credentials are configured:
   - `SQS_AWS_ACCESS_KEY`
   - `SQS_AWS_SECRET_KEY`
   - `SQS_AWS_REGION`
   - `SQS_ENDPOINT`
   - `SQS_REGION`
   - `SES_EVENTS_SQS_URL`
   - `SES_CONFIGURATION_SET`
3. Deploy the service

## Verification

### Check if SQS is Disabled
Look for this log message on startup:
```
AWS SQS is disabled. Excluding SqsAutoConfiguration from auto-configuration.
```

### Check if SQS is Enabled
Look for these log messages on startup:
```
Creating SqsAsyncClient with configured credentials
Starting SQS listener for queue: vacademy-ses-events
```

## Files Modified/Created

### Created:
- `src/main/java/vacademy/io/notification_service/config/SqsAutoConfigurationExcluder.java`
- `src/main/resources/META-INF/spring.factories`
- `src/main/resources/META-INF/spring/org.springframework.boot.env.EnvironmentPostProcessor.imports`
- `AWS_SQS_CONFIGURATION.md`
- `SQS_DISABLE_SOLUTION_SUMMARY.md` (this file)

### Modified:
- `src/main/java/vacademy/io/notification_service/config/AwsSqsConfig.java`
- `src/main/java/vacademy/io/notification_service/service/SqsEmailEventListener.java`
- `src/main/resources/application-k8s-local.properties`
- `src/main/resources/application-stage.properties`
- `src/main/resources/application-prod.properties`
- `src/test/resources/application-test.properties`
- `.github/workflows/maven-publish-notification-service.yml`

## Testing Recommendations

1. **Local Testing:** Start the service with `environment=k8s-local` and verify it starts without AWS errors
2. **Stage Testing:** Deploy with `AWS_SQS_ENABLED=false` and verify service starts successfully
3. **Production Testing:** Deploy with `AWS_SQS_ENABLED=true` and verify SQS listeners are active
4. **Email Tracking:** Send test emails and verify events are processed (when SQS is enabled)

## Troubleshooting

If you still see SQS connection errors:
1. Verify the `aws.sqs.enabled` property value in your active profile
2. Check for the exclusion log message: "AWS SQS is disabled. Excluding SqsAutoConfiguration..."
3. Ensure `META-INF/spring.factories` or `META-INF/spring/...EnvironmentPostProcessor.imports` exists
4. Rebuild the project: `mvn clean install`
5. Check that no other configurations are forcing SQS bean creation

## Benefits

1. **Environment Flexibility:** Run in environments without AWS
2. **Cost Optimization:** Disable SQS in non-production environments
3. **Development Speed:** Faster local development without AWS dependencies
4. **Deployment Control:** Toggle functionality via environment variable without code changes
5. **Error Prevention:** No more startup failures due to missing AWS configuration

