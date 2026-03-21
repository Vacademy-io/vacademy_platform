# Sentry Alerts Configuration Guide for Vacademy Platform

## 🎯 Overview

This guide provides step-by-step instructions for setting up critical Sentry alerts for payment processing, workflows, and other critical operations in the Vacademy platform.

---

## 📋 Table of Contents

1. [Payment Alert Rules](#payment-alert-rules)
2. [Workflow Alert Rules](#workflow-alert-rules)  
3. [Alert Configuration Steps](#alert-configuration-steps)
4. [Alert Channels](#alert-channels)
5. [Testing Alerts](#testing-alerts)

---

## 💳 Payment Alert Rules

### 1. **Critical: Payment Log Not Found**

**Description:** Alert when payment logs cannot be found, indicating potential data integrity issues.

**Sentry Alert Configuration:**
```
Alert Name: Payment Log Not Found - Critical
Severity: Critical
```

**Filter Conditions:**
```
operation:updatePaymentLog OR operation:updatePaymentLogWithRetry OR operation:storeInvoiceUrl
AND
payment.log.id:*
```

**Threshold:**
- Trigger when: **3 events in 5 minutes**
- Notify: **#payments-critical** Slack channel + Email to payment team

**Action Items:**
- Check database for payment log existence
- Verify payment initiation flow
- Check for race conditions in payment creation

---

### 2. **Critical: Webhook Signature Verification Failed**

**Description:** Alert on signature verification failures which could indicate security issues or misconfiguration.

**Sentry Alert Configuration:**
```
Alert Name: Webhook Signature Verification Failed
Severity: Critical
```

**Filter Conditions:**
```
operation:verifyWebhookSignature OR operation:verifySignature
AND
(payment.vendor:RAZORPAY OR payment.vendor:STRIPE OR payment.vendor:EWAY)
```

**Threshold:**
- Trigger when: **5 events in 10 minutes**
- Notify: **#security-alerts** + **#payments-critical** + PagerDuty

**Action Items:**
- Verify webhook secret is correctly configured
- Check if gateway updated their webhook signing
- Review recent institute configuration changes
- Potential security incident - investigate immediately

---

### 3. **High: Webhook Secret Not Found**

**Description:** Alert when payment gateway webhook secrets are missing from configuration.

**Sentry Alert Configuration:**
```
Alert Name: Payment Gateway Webhook Secret Missing
Severity: High
```

**Filter Conditions:**
```
operation:getWebhookSecret
AND
(payment.vendor:RAZORPAY OR payment.vendor:STRIPE OR payment.vendor:EWAY)
```

**Threshold:**
- Trigger when: **1 event per institute_id in 1 hour**
- Notify: **#payments-high** Slack channel

**Action Items:**
- Add webhook secret to institute payment gateway configuration
- Verify institute onboarding process
- Update institute's payment gateway settings

---

### 4. **High: Invoice Generation Failed**

**Description:** Alert when invoice generation fails for successful payments.

**Sentry Alert Configuration:**
```
Alert Name: Payment Invoice Generation Failed
Severity: High
```

**Filter Conditions:**
```
(operation:generateRazorpayInvoice OR operation:callRazorpayInvoiceAPI OR operation:generateAndStoreRazorpayInvoice)
AND
payment.vendor:RAZORPAY
```

**Threshold:**
- Trigger when: **10 events in 1 hour**
- Notify: **#payments-high** Slack channel

**Action Items:**
- Check Razorpay API credentials
- Verify Razorpay API status
- Check for rate limiting issues
- Review error messages for specific failures

---

### 5. **High: Gateway Credentials Not Found**

**Description:** Alert when payment gateway API credentials are missing or invalid.

**Sentry Alert Configuration:**
```
Alert Name: Payment Gateway Credentials Missing
Severity: High
```

**Filter Conditions:**
```
(operation:getRazorpayCredentials OR operation:getRazorpayApiCredentials)
AND
(has.keyId:"false" OR has.keySecret:"false")
```

**Threshold:**
- Trigger when: **1 event per institute_id in 1 hour**
- Notify: **#payments-high** Slack channel + Email

**Action Items:**
- Add missing credentials to institute configuration
- Verify credential field names match expected format
- Check institute onboarding documentation

---

### 6. **Medium: Payment Data Parsing Failed**

**Description:** Alert on payment data parsing failures which could indicate data corruption.

**Sentry Alert Configuration:**
```
Alert Name: Payment Data Parsing Failed
Severity: Medium
```

**Filter Conditions:**
```
(operation:parsePaymentData OR operation:parsePaymentResponseRequest OR operation:parseDonationPaymentData)
AND
payment.log.id:*
```

**Threshold:**
- Trigger when: **15 events in 1 hour**
- Notify: **#payments-medium** Slack channel

**Action Items:**
- Check payment_specific_data JSON structure
- Verify data serialization logic
- Look for recent code changes affecting payment data

---

### 7. **Medium: Donation Notification Failed**

**Description:** Alert when donation confirmation emails fail to send.

**Sentry Alert Configuration:**
```
Alert Name: Donation Notification Send Failed
Severity: Medium
```

**Filter Conditions:**
```
operation:sendDonationNotification
AND
payment.type:DONATION
```

**Threshold:**
- Trigger when: **5 events in 30 minutes**
- Notify: **#payments-medium** Slack channel

**Action Items:**
- Check email service status
- Verify donation email templates
- Review donor email extraction logic

---

### 8. **Medium: Eway Webhook Timeout**

**Description:** Alert when Eway webhook polling times out after 30 minutes.

**Sentry Alert Configuration:**
```
Alert Name: Eway Webhook Polling Timeout
Severity: Medium
```

**Filter Conditions:**
```
operation:handleEwayTimeout
AND
payment.vendor:EWAY
```

**Threshold:**
- Trigger when: **3 events in 1 hour**
- Notify: **#payments-medium** Slack channel

**Action Items:**
- Check Eway API status
- Verify transaction status in Eway dashboard
- Review timeout configuration (currently 30 minutes)

---

## 🔄 Workflow Alert Rules

### 9. **Critical: Workflow Execution Failed**

**Description:** Alert on workflow execution failures that could impact user experience.

**Sentry Alert Configuration:**
```
Alert Name: Workflow Execution Failed - Critical
Severity: Critical
```

**Filter Conditions:**
```
operation:workflowExecution OR operation:handleSendEmailNode OR operation:handleSendWhatsAppNode OR operation:handleHttpRequestNode
AND
workflow.execution.id:*
```

**Threshold:**
- Trigger when: **10 events in 5 minutes** for same workflow.id
- Notify: **#workflows-critical** Slack channel

**Action Items:**
- Check workflow configuration
- Verify external service connectivity (email, WhatsApp, API)
- Review workflow execution logs

---

### 10. **High: WhatsApp Batch Send Failed**

**Description:** Alert when WhatsApp message batches fail to send.

**Sentry Alert Configuration:**
```
Alert Name: WhatsApp Batch Send Failed
Severity: High
```

**Filter Conditions:**
```
operation:sendWhatsAppBatch
AND
node.type:SEND_WHATSAPP
AND
batch.count:*
```

**Threshold:**
- Trigger when: **Failure rate > 10%** in 10 minutes
- Notify: **#workflows-high** Slack channel

**Action Items:**
- Check WhatsApp API status
- Verify template approval status
- Review batch size and rate limiting
- Check institute WhatsApp API credentials

---

### 11. **High: Email Batch Send Failed**

**Description:** Alert when email batches fail to send.

**Sentry Alert Configuration:**
```
Alert Name: Email Batch Send Failed
Severity: High
```

**Filter Conditions:**
```
(operation:sendRegularEmailBatch OR operation:sendAttachmentEmailBatch)
AND
node.type:SEND_EMAIL
```

**Threshold:**
- Trigger when: **5 batches fail in 10 minutes**
- Notify: **#workflows-high** Slack channel

**Action Items:**
- Check email service provider status
- Verify email templates and content
- Review email recipient validation
- Check for spam/bounce issues

---

### 12. **Medium: HTTP Request Node Failed**

**Description:** Alert on external API call failures in workflows.

**Sentry Alert Configuration:**
```
Alert Name: Workflow HTTP Request Failed
Severity: Medium
```

**Filter Conditions:**
```
(operation:executeHttpRequest OR operation:handleHttpRequestNode)
AND
node.type:HTTP_REQUEST
AND
http.status.code:>=400
```

**Threshold:**
- Trigger when: **15 events in 15 minutes**
- Notify: **#workflows-medium** Slack channel

**Action Items:**
- Check external API status
- Verify API credentials and endpoints
- Review request payload and headers
- Check for rate limiting

---

### 13. **Medium: Workflow Schedule Failures**

**Description:** Alert when scheduled workflows fail to execute.

**Sentry Alert Configuration:**
```
Alert Name: Scheduled Workflow Execution Failed
Severity: Medium
```

**Filter Conditions:**
```
(operation:getDueSchedules OR operation:createSchedule OR operation:updateSchedule)
AND
schedule.id:*
```

**Threshold:**
- Trigger when: **5 events in 30 minutes**
- Notify: **#workflows-medium** Slack channel

**Action Items:**
- Check schedule configuration (cron, interval)
- Verify workflow execution permissions
- Review scheduler service status

---

## 🔧 Alert Configuration Steps

### Step 1: Access Sentry Alerts

1. Log in to [Sentry.io](https://sentry.io)
2. Select your **Vacademy** project
3. Go to **Alerts** in the left sidebar
4. Click **Create Alert Rule**

### Step 2: Create Alert Rule

1. **Choose Alert Type:**
   - Select "Issues"
   - Choose "Create Metric Alert" for threshold-based alerts
   - Choose "Create Issue Alert" for immediate notifications

2. **Set Environment:**
   - Environment: `production` (or `all` for testing)
   - Tag filters: Add filter conditions from above

3. **Define Conditions:**
   - Paste the filter query from the alert configuration
   - Set the threshold (events, frequency, percentage)
   - Set time window (5 minutes, 10 minutes, 1 hour, etc.)

4. **Configure Actions:**
   - Add Slack integration
   - Add Email notifications
   - Add PagerDuty for critical alerts (optional)
   - Add ticketing system integration (optional)

### Step 3: Test Alert

1. Review alert configuration
2. Use "Test Alert" feature if available
3. Trigger a test event from staging environment
4. Verify notification is received

### Step 4: Save and Enable

1. Name your alert clearly (see naming convention below)
2. Add description with action items
3. Assign alert owner/team
4. Enable the alert
5. Document alert in team wiki

---

## 📢 Alert Channels

### Slack Channels (Recommended Setup)

```
#payments-critical     - Critical payment failures (immediate attention)
#payments-high         - High priority payment issues (within 1 hour)
#payments-medium       - Medium priority payment issues (within 4 hours)

#workflows-critical    - Critical workflow failures (immediate attention)
#workflows-high        - High priority workflow issues (within 1 hour)
#workflows-medium      - Medium priority workflow issues (within 4 hours)

#security-alerts       - Security-related issues (immediate attention)
#devops-alerts         - Infrastructure and deployment issues
```

### Email Distribution Lists

```
payments-oncall@vacademy.io        - Critical payment alerts
workflows-oncall@vacademy.io       - Critical workflow alerts  
security-team@vacademy.io          - Security alerts
engineering-leads@vacademy.io      - High severity alerts
```

### PagerDuty (For Critical Alerts Only)

- Set up PagerDuty integration for critical alerts
- Configure escalation policy:
  - Primary: On-call engineer (5 min)
  - Secondary: Engineering manager (10 min)
  - Tertiary: Engineering director (15 min)

---

## 🧪 Testing Alerts

### Testing in Staging Environment

1. **Create Test Scenarios:**
   ```
   # Test payment log not found
   - Create payment with non-existent log ID
   
   # Test webhook signature failure
   - Send webhook with invalid signature
   
   # Test missing credentials
   - Remove gateway credentials from config
   
   # Test workflow failures
   - Configure workflow with invalid email template
   - Configure workflow with unreachable HTTP endpoint
   ```

2. **Verify Alert Triggers:**
   - Check Sentry dashboard for events
   - Verify alert fires within expected timeframe
   - Confirm notifications sent to correct channels

3. **Validate Alert Content:**
   - Alert message is clear and actionable
   - Correct severity level
   - Includes relevant context (tags, error details)
   - Links to Sentry event for investigation

---

## 📊 Alert Naming Convention

Use this format for consistent alert names:

```
[Severity] [Component] [Error Type] - [Impact]

Examples:
✅ Critical: Payment Log Not Found - Data Integrity
✅ High: Webhook Secret Missing - Payment Processing Blocked
✅ Medium: Email Batch Failed - Notification Delayed
✅ Critical: Workflow Schedule Failed - User Impact
```

---

## 🔍 Alert Monitoring Best Practices

### 1. **Regular Review**
- Review all alerts weekly
- Check for false positives
- Adjust thresholds based on actual traffic
- Archive or disable stale alerts

### 2. **Alert Fatigue Prevention**
- Avoid setting alerts for expected errors
- Use appropriate severity levels
- Batch similar events when possible
- Set realistic thresholds

### 3. **Documentation**
- Document each alert's purpose
- Include runbook for each alert
- Keep action items updated
- Track alert resolution time

### 4. **Metrics to Track**
- Alert frequency
- Mean time to resolution (MTTR)
- False positive rate
- Alert coverage (% of critical errors with alerts)

---

## 📝 Sentry Alert Queries Reference

### Payment Queries

```
# All Razorpay errors
payment.vendor:RAZORPAY

# All Stripe errors
payment.vendor:STRIPE

# All webhook signature failures
operation:verifyWebhookSignature OR operation:verifySignature

# All payment log errors
payment.log.id:* AND (operation:*PaymentLog* OR operation:*paymentLog*)

# All invoice generation errors
operation:*Invoice* OR operation:*invoice*

# High volume payment failures (>100 users affected)
user.count:>100 OR batch.count:>10
```

### Workflow Queries

```
# All workflow errors
workflow.execution.id:*

# WhatsApp node failures
node.type:SEND_WHATSAPP

# Email node failures  
node.type:SEND_EMAIL

# HTTP request failures
node.type:HTTP_REQUEST AND http.status.code:>=400

# Transform/query failures
node.type:TRANSFORM OR node.type:QUERY

# Specific workflow errors
workflow.id:"wf_123"
```

---

## 🚨 Emergency Response Procedures

### Critical Alert Response (< 5 min)

1. **Acknowledge Alert**
   - Acknowledge in Sentry/PagerDuty
   - Post in Slack channel

2. **Quick Assessment**
   - Check Sentry event details
   - Review error rate and affected users
   - Check if issue is ongoing

3. **Immediate Actions**
   - If payment processing is blocked: escalate immediately
   - If security-related: notify security team
   - If affecting many users: create incident

4. **Communicate**
   - Update status page if user-facing
   - Notify stakeholders
   - Regular updates until resolved

### High/Medium Alert Response (< 1 hour)

1. **Investigate**
   - Review Sentry events and stack traces
   - Check logs and metrics
   - Identify root cause

2. **Fix or Mitigate**
   - Deploy fix if available
   - Implement workaround if needed
   - Document temporary solution

3. **Verify**
   - Test fix in staging
   - Deploy to production
   - Monitor for recurrence

4. **Post-Mortem**
   - Document root cause
   - Identify preventive measures
   - Update runbooks

---

## ✅ Checklist: Alert Setup Complete

Use this checklist to ensure all alerts are properly configured:

### Payment Alerts
- [ ] Payment Log Not Found - Critical
- [ ] Webhook Signature Verification Failed - Critical
- [ ] Webhook Secret Not Found - High
- [ ] Invoice Generation Failed - High
- [ ] Gateway Credentials Not Found - High
- [ ] Payment Data Parsing Failed - Medium
- [ ] Donation Notification Failed - Medium
- [ ] Eway Webhook Timeout - Medium

### Workflow Alerts
- [ ] Workflow Execution Failed - Critical
- [ ] WhatsApp Batch Send Failed - High
- [ ] Email Batch Send Failed - High
- [ ] HTTP Request Node Failed - Medium
- [ ] Workflow Schedule Failures - Medium

### Infrastructure
- [ ] Slack channels created
- [ ] Email distribution lists configured
- [ ] PagerDuty integration set up (if using)
- [ ] Alert runbooks documented
- [ ] Team trained on alert response

---

## 📚 Additional Resources

- [Sentry Alerts Documentation](https://docs.sentry.io/product/alerts/)
- [Sentry Metric Alerts](https://docs.sentry.io/product/alerts/alert-types/#metric-alerts)
- [Slack Integration Guide](https://docs.sentry.io/product/integrations/notification-incidents/slack/)
- [PagerDuty Integration](https://docs.sentry.io/product/integrations/notification-incidents/pagerduty/)

---

## 🤝 Support

For questions or issues with Sentry alerts:
- Engineering Team: #engineering-support
- DevOps Team: #devops-support
- Sentry Admin: sentry-admin@vacademy.io
