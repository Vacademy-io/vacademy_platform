# AWS SQS/SNS Configuration Guide

## Overview

The notification service now supports conditional enabling/disabling of AWS SQS and SNS functionality through environment variables. This allows you to run the service without AWS dependencies in local or test environments.

## Configuration

### Environment Variable

Set the `AWS_SQS_ENABLED` environment variable to control SQS/SNS functionality:

- `true` - Enable SQS listeners and AWS configuration (default for stage/prod)
- `false` - Disable SQS listeners and AWS configuration (default for local/test)

### Property Files Configuration

#### Local Development (`application-k8s-local.properties`)
```properties
aws.sqs.enabled=false
spring.autoconfigure.exclude=io.awspring.cloud.autoconfigure.sqs.SqsAutoConfiguration
```

#### Stage/Production (`application-stage.properties`, `application-prod.properties`)
```properties
aws.sqs.enabled=${AWS_SQS_ENABLED:true}
```
Note: For stage/prod, the SqsAutoConfigurationExcluder will automatically exclude the SQS auto-configuration when `aws.sqs.enabled=false`.

#### Test Environment (`application-test.properties`)
```properties
aws.sqs.enabled=false
spring.autoconfigure.exclude=io.awspring.cloud.autoconfigure.sqs.SqsAutoConfiguration
```

## How It Works

When `aws.sqs.enabled=false`:
1. `SqsAutoConfigurationExcluder` (EnvironmentPostProcessor) detects the setting early in Spring Boot lifecycle
2. Spring Cloud AWS SQS auto-configuration (`SqsAutoConfiguration`) is excluded from loading
3. `AwsSqsConfig` bean will not be created (no custom SQS client initialization)
4. `SqsEmailEventListener` will not be created (no SQS listeners)
5. Service will start successfully without attempting to connect to AWS SQS

When `aws.sqs.enabled=true`:
1. Spring Cloud AWS SQS auto-configuration is loaded normally
2. AWS SQS client is initialized with provided credentials
3. SQS listener starts listening to the `vacademy-ses-events` queue
4. Email events are processed from SQS messages

### Technical Implementation

The solution uses an `EnvironmentPostProcessor` (`SqsAutoConfigurationExcluder`) that runs before Spring Boot auto-configuration. It checks the `aws.sqs.enabled` property and dynamically adds `io.awspring.cloud.autoconfigure.sqs.SqsAutoConfiguration` to the `spring.autoconfigure.exclude` property when SQS is disabled.

## GitHub Actions Setup

Add the following secret to your GitHub repository:

**Secret Name:** `AWS_SQS_ENABLED`
**Secret Value:** `true` (for stage/prod) or `false` (to disable)

The GitHub Actions workflow will automatically pass this to the deployment.

## Deployment Environments

### Local Kubernetes
- SQS is **disabled** by default
- No AWS credentials needed
- Service starts without AWS connectivity

### Stage/Production Kubernetes
- SQS is **enabled** by default (can be disabled via `AWS_SQS_ENABLED=false`)
- Requires AWS credentials in secrets
- Email tracking via SES events will work

## Troubleshooting

### Error: UnknownHostException for SQS endpoint

This error occurs when SQS is enabled but AWS credentials or endpoint is not configured properly.

**Solution:**
- For local development: Ensure `aws.sqs.enabled=false` in `application-k8s-local.properties`
- For production: Set `AWS_SQS_ENABLED=false` in GitHub secrets or provide valid AWS credentials

### Service won't start in local environment

Check that:
1. `application-k8s-local.properties` has:
   - `aws.sqs.enabled=false`
   - `spring.autoconfigure.exclude=io.awspring.cloud.autoconfigure.sqs.SqsAutoConfiguration`
2. Your active profile is set to `k8s-local` via `environment=k8s-local`
3. The `META-INF/spring.factories` file exists and registers the `SqsAutoConfigurationExcluder`

### Error: "The URI scheme of endpointOverride must not be null"

This error occurs when Spring Cloud AWS SQS auto-configuration is trying to initialize even though you want it disabled.

**Solution:**
- Ensure `aws.sqs.enabled=false` is set in your active profile's properties file
- Verify that `SqsAutoConfigurationExcluder` is registered in `META-INF/spring.factories`
- Check logs for the message: "AWS SQS is disabled. Excluding SqsAutoConfiguration from auto-configuration."

## Required AWS Credentials (when SQS is enabled)

When `aws.sqs.enabled=true`, ensure these environment variables are set:

- `SQS_AWS_ACCESS_KEY` - AWS access key
- `SQS_AWS_SECRET_KEY` - AWS secret key
- `SQS_AWS_REGION` - AWS region (e.g., us-east-1)
- `SQS_ENDPOINT` - SQS endpoint URL
- `SQS_REGION` - SQS region
- `SES_EVENTS_SQS_URL` - SQS queue URL for SES events
- `SES_CONFIGURATION_SET` - SES configuration set name

## Examples

### Disable SQS in Stage Environment

Set GitHub secret:
```
AWS_SQS_ENABLED=false
```

### Enable SQS in Local Testing (not recommended)

Override in your local environment:
```bash
export AWS_SQS_ENABLED=true
# Also set all required AWS credentials
```

### Running Tests

Tests automatically disable SQS via `application-test.properties`, so no additional configuration is needed.

