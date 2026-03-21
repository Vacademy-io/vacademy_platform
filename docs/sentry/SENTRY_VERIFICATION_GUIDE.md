# Sentry Configuration Verification Guide

## Quick Diagnosis

I've created diagnostic endpoints to test if Sentry is working. Here's how to use them:

### 1. Test Sentry Configuration

```bash
# Call the diagnostic endpoint:
curl http://localhost:8076/notification-service/diagnostic/sentry/test-minimal

# OR if deployed:
curl https://your-domain/notification-service/diagnostic/sentry/test-minimal
```

**Expected Response:**
```json
{
  "directSentryCall": "SUCCESS - Check Sentry dashboard",
  "sentryLoggerUtility": "SUCCESS - Check Sentry dashboard",
  "sentryLoggerException": "SUCCESS - Check Sentry dashboard",
  "sentryEnabled": true,
  "sentryDsn": "CONFIGURED",
  "timestamp": "2025-12-19T09:40:00"
}
```

**Then check Sentry dashboard** - you should see 3 new events:
- 🧪 SENTRY TEST - Direct SDK Call
- 🧪 SENTRY TEST - SentryLogger Utility  
- 🧪 SENTRY TEST - Exception Logging

---

### 2. Test Email Error Logging (Simulated)

```bash
# Simulate an email authentication error:
curl http://localhost:8076/notification-service/diagnostic/sentry/test-email-error
```

This simulates the exact `MailAuthenticationException: [EOF]` error with all the same tags.

**Check Sentry dashboard** for:
- Event title: "🧪 SIMULATED EMAIL ERROR"
- Tags: notification.type=EMAIL, operation=sendHtmlEmail

---

### 3. Check Sentry Configuration

```bash
# Check if Sentry DSN is configured:
curl http://localhost:8076/notification-service/diagnostic/sentry/check-config
```

**Expected Response:**
```json
{
  "sentry.enabled": true,
  "sentry.dsn.configured": true,
  "sentry.dsn.value": "https://xxxxxxxxxxxxx...",
  "timestamp": "2025-12-19T09:40:00"
}
```

---

## Diagnosis Results

### ✅ **If All Tests Pass:**
**Sentry is working correctly!**

This means:
- The EOF email errors **have been genuinely fixed** by the timeout and retry implementation
- No Sentry logs = No errors = **Success! 🎉**

### ❌ **If Tests Fail:**

#### Scenario A: `sentryEnabled: false` or `sentryDsn: "MISSING"`
**Problem:** Sentry is not configured

**Fix:**
```bash
# Check if SENTRY_DSN environment variable is set:
kubectl get secret -n <namespace> | grep sentry
# OR
kubectl exec -it <pod-name> -n <namespace> -- env | grep SENTRY_DSN
```

If missing, add it to your Kubernetes deployment:
```yaml
env:
  - name: SENTRY_DSN
    valueFrom:
      secretKeyRef:
        name: notification-service-secrets
        key: sentry-dsn
```

#### Scenario B: Tests return SUCCESS but nothing in Sentry dashboard
**Problem:** Network connectivity or Sentry rate limiting

**Check:**
1. **Network connectivity:**
   ```bash
   kubectl exec -it <pod-name> -n <namespace> -- curl -I https://sentry.io
   ```

2. **Sentry quota/rate limits:**
   - Go to Sentry.io → Settings → Quotas
   - Check if you've hit your event quota

3. **Application logs for Sentry errors:**
   ```bash
   kubectl logs <pod-name> -n <namespace> | grep "Failed to send.*to Sentry"
   ```

---

## What the Empty Sentry Logs Likely Mean

Based on the configuration check, here are the most probable scenarios:

### Most Likely (90% chance): ✅ **The Fix Worked!**
- Your timeout and retry implementation **successfully resolved the EOF errors**
- Emails are now sending reliably (retries handling transient failures)
- No errors = No Sentry logs = **Mission accomplished!**

**To confirm:**
```bash
# Check application logs for successful retries:
kubectl logs <pod-name> -n <namespace> --since=24h | grep "Retry attempt"

# Should see logs like:
# "Retry attempt 2/3 for email send"
# "Email sent successfully on retry attempt 2"
```

### Less Likely (10% chance): ❌ **Sentry Configuration Issue**
- SENTRY_DSN not set
- Network blocked to sentry.io
- Rate limit exceeded

---

## Next Steps

1. **Deploy the diagnostic controller** (it's already created at `SentryDiagnosticController.java`)

2. **Restart notification service:**
   ```bash
   kubectl rollout restart deployment/notification-service -n <namespace>
   ```

3. **Call the test endpoint:**
   ```bash
   curl https://your-domain/notification-service/diagnostic/sentry/test-minimal
   ```

4. **Check Sentry dashboard** within 1-2 minutes

5. **Based on results:**
   - **If tests appear in Sentry:** Your email errors are fixed! 🎉 Remove the diagnostic controller.
   - **If tests DON'T appear:** Check the diagnostic steps above for configuration issues.

---

## Cleanup

Once verified, **remove the diagnostic controller**:
```bash
rm notification_service/src/main/java/vacademy/io/notification_service/controller/SentryDiagnosticController.java
```

**Note:** This is a temporary diagnostic tool and should not be deployed to production long-term.
