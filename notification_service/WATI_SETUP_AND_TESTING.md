# WATI Setup and Testing Guide

## Quick Start Guide

This guide walks you through setting up WATI integration for WhatsApp notifications in the notification service.

---

## 📋 Prerequisites

1. **WATI Account** - Sign up at https://www.wati.io/
2. **WhatsApp Business Account** - Connected to WATI
3. **API Access** - Enabled in your WATI account
4. **Phone Numbers** - Test phone numbers for verification

---

## 🔧 Step 1: WATI Account Setup

### 1.1 Create WATI Account

1. Go to https://www.wati.io/
2. Click "Start Free Trial" or "Sign Up"
3. Complete registration with business email
4. Verify your email address

### 1.2 Connect WhatsApp Business

1. Login to WATI dashboard
2. Go to "Settings" → "WhatsApp"
3. Follow the wizard to connect your WhatsApp Business account
4. Complete phone number verification

### 1.3 Get API Credentials

1. Navigate to "Settings" → "API"
2. Copy your **API Key** (looks like: `eyJhbGciOiJIUzI1...`)
3. Note your **API Endpoint**: Usually `https://live-server.wati.io`
4. Copy your **WhatsApp Number** (with country code, e.g., `919876543210`)

**Important**: Keep your API key secure. Never commit it to version control.

---

## 📝 Step 2: Create WhatsApp Templates

### 2.1 Navigate to Templates

1. In WATI dashboard, go to "Templates" section
2. Click "Create Template"

### 2.2 Create Your First Template

**Example: Assignment Reminder Template**

```
Template Name: assignment_reminder
Category: UTILITY
Language: English

Header: None

Body:
Hello {{1}},

Your assignment *{{2}}* is due on {{3}}.

Please submit it on time to avoid penalties.

Thank you,
{{4}}

Footer: This is an automated message from your school.

Buttons: None
```

**Parameter Mapping:**
- `{{1}}` = Student name
- `{{2}}` = Assignment title
- `{{3}}` = Due date
- `{{4}}` = School/Teacher name

### 2.3 Submit for Approval

1. Review your template
2. Click "Submit for Approval"
3. Wait for WhatsApp to approve (usually 1-24 hours)
4. Check approval status in Templates section

### 2.4 Create More Templates

Create templates for common use cases:

**Exam Notification:**
```
Template Name: exam_notification
Body:
Dear {{1}},

Your {{2}} exam is scheduled for:
📅 Date: {{3}}
🕐 Time: {{4}}
📍 Venue: {{5}}

All the best! 🎓
```

**Class Reminder:**
```
Template Name: class_reminder
Body:
Hi {{1}},

Your {{2}} class is starting in {{3}} minutes.

Join now: {{4}}

See you in class! 👋
```

**Fee Payment Reminder:**
```
Template Name: fee_reminder
Body:
Dear Parent,

This is a reminder that the fee payment of ₹{{1}} for {{2}} is due on {{3}}.

Please pay at your earliest convenience.

Thank you!
```

---

## ⚙️ Step 3: Configure Institute Settings

### 3.1 Understand Configuration Structure

The notification service stores WhatsApp settings in the institute's JSON configuration.

**Basic WATI Configuration:**
```json
{
  "setting": {
    "WHATSAPP_SETTING": {
      "data": {
        "UTILITY_WHATSAPP": {
          "provider": "WATI",
          "wati": {
            "apiKey": "YOUR_WATI_API_KEY_HERE",
            "apiUrl": "https://live-server.wati.io",
            "whatsappNumber": "919876543210"
          }
        }
      }
    }
  }
}
```

### 3.2 Update Institute Settings via API

**Method 1: Using Postman/cURL**

```bash
curl -X POST "http://your-domain.com/admin-core-service/v1/institutes/INST_123/settings" \
  -H "Content-Type: application/json" \
  -d '{
    "setting": {
      "WHATSAPP_SETTING": {
        "data": {
          "UTILITY_WHATSAPP": {
            "provider": "WATI",
            "wati": {
              "apiKey": "your-actual-wati-api-key",
              "apiUrl": "https://live-server.wati.io",
              "whatsappNumber": "919876543210"
            }
          }
        }
      }
    }
  }'
```

**Method 2: Using Admin Dashboard**

1. Login to admin dashboard
2. Navigate to Institute Settings
3. Go to Notifications → WhatsApp
4. Select "WATI" as provider
5. Enter API Key, API URL, and WhatsApp Number
6. Click "Save"

### 3.3 Verify Configuration

```bash
curl -X GET "http://your-domain.com/admin-core-service/v1/institutes/INST_123/settings"
```

Check that `WHATSAPP_SETTING.data.UTILITY_WHATSAPP.provider` is set to `"WATI"`.

---

## 🧪 Step 4: Testing

### 4.1 Test Direct WhatsApp API

**Test 1: Send to Your Own Number**

```bash
curl -X POST "http://localhost:8076/notification-service/whatsapp/v1/send-template-whatsapp?instituteId=INST_123" \
  -H "Content-Type: application/json" \
  -d '{
    "templateName": "assignment_reminder",
    "userDetails": [
      {
        "YOUR_PHONE_NUMBER": {
          "1": "Test Student",
          "2": "Math Homework",
          "3": "Tomorrow 5 PM",
          "4": "ABC School"
        }
      }
    ],
    "languageCode": "en"
  }'
```

**Replace:**
- `YOUR_PHONE_NUMBER` with your actual number (e.g., `919876543210`)
- `INST_123` with your actual institute ID

**Expected Response:**
```json
[
  {
    "919876543210": true
  }
]
```

**Check Your Phone:** You should receive the WhatsApp message within seconds.

### 4.2 Test via Announcement System

**Test 2: Create Announcement with WhatsApp Medium**

```bash
curl -X POST "http://localhost:8076/notification-service/v1/announcements" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Assignment Reminder",
    "content": {
      "type": "text",
      "content": "This is a test announcement"
    },
    "instituteId": "INST_123",
    "createdBy": "ADMIN_1",
    "createdByName": "Admin User",
    "createdByRole": "ADMIN",
    "recipients": [
      {
        "recipientType": "USER",
        "recipientId": "YOUR_USER_ID"
      }
    ],
    "modes": [
      {
        "modeType": "SYSTEM_ALERT",
        "settings": {
          "priority": "HIGH"
        }
      }
    ],
    "mediums": [
      {
        "mediumType": "WHATSAPP",
        "config": {
          "template_name": "assignment_reminder",
          "dynamic_values": {
            "1": "{{user_name}}",
            "2": "Test Assignment",
            "3": "Tomorrow 5 PM",
            "4": "Test School"
          }
        }
      }
    ],
    "scheduling": {
      "scheduleType": "IMMEDIATE"
    }
  }'
```

### 4.3 Test Multiple Recipients

**Test 3: Bulk Send to Multiple Users**

```bash
curl -X POST "http://localhost:8076/notification-service/whatsapp/v1/send-template-whatsapp?instituteId=INST_123" \
  -H "Content-Type: application/json" \
  -d '{
    "templateName": "class_reminder",
    "userDetails": [
      {
        "919876543210": {
          "1": "Student 1",
          "2": "Mathematics",
          "3": "10",
          "4": "https://meet.google.com/abc-defg-hij"
        }
      },
      {
        "918765432109": {
          "1": "Student 2",
          "2": "Mathematics",
          "3": "10",
          "4": "https://meet.google.com/abc-defg-hij"
        }
      }
    ],
    "languageCode": "en"
  }'
```

---

## 🔍 Step 5: Monitoring and Debugging

### 5.1 Check Logs

**Application Logs:**
```bash
# Check notification service logs
kubectl logs -f deployment/notification-service -n vacademy

# Filter for WATI-related logs
kubectl logs deployment/notification-service -n vacademy | grep -i wati
```

**Look for:**
- `"Sending WhatsApp messages via WATI"` - Message sending initiated
- `"WATI Response for {phone}: 200"` - Successful send
- `"Error sending via WATI"` - Failed send

### 5.2 Check Database

**Query recipient messages:**
```sql
-- Check recent WhatsApp messages
SELECT 
    id,
    user_id,
    announcement_id,
    status,
    sent_at,
    delivered_at,
    error_message
FROM recipient_messages
WHERE medium_type = 'WHATSAPP'
ORDER BY created_at DESC
LIMIT 20;

-- Check failed messages
SELECT 
    rm.id,
    rm.user_id,
    rm.status,
    rm.error_message,
    a.title as announcement_title
FROM recipient_messages rm
JOIN announcements a ON rm.announcement_id = a.id
WHERE rm.medium_type = 'WHATSAPP'
AND rm.status = 'FAILED'
ORDER BY rm.created_at DESC;

-- Delivery rate statistics
SELECT 
    DATE(sent_at) as date,
    COUNT(*) as total,
    SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered,
    SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
    ROUND(100.0 * SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) / COUNT(*), 2) as delivery_rate
FROM recipient_messages
WHERE medium_type = 'WHATSAPP'
AND sent_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(sent_at)
ORDER BY date DESC;
```

### 5.3 WATI Dashboard Monitoring

1. Login to WATI dashboard
2. Go to "Reports" section
3. Check:
   - Message delivery status
   - Failed messages with reasons
   - Template usage statistics
   - API call logs

### 5.4 Common Issues and Solutions

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| Template not found (470) | Template not approved or wrong name | Check template approval status in WATI |
| Invalid phone number (471) | Wrong format or invalid number | Ensure country code, no spaces/special chars |
| Unauthorized (401) | Wrong API key | Verify API key in settings |
| Rate limit (429) | Too many requests | Implement batching, reduce frequency |
| Connection timeout | Network issues | Check WATI server status |

---

## 🔄 Step 6: Set Up Webhooks (Optional)

### 6.1 Configure Webhook in WATI

1. Go to WATI dashboard → "Settings" → "Webhooks"
2. Add webhook URL:
   ```
   https://your-domain.com/notification-service/whatsapp/v1/wati-webhook
   ```
3. Select events to receive:
   - ✅ Message Sent
   - ✅ Message Delivered
   - ✅ Message Read
   - ✅ Message Failed
4. Save webhook configuration

### 6.2 Test Webhook

**Send test webhook from WATI dashboard:**
1. Go to Webhooks section
2. Click "Test Webhook"
3. Check application logs for received webhook

**Check logs:**
```bash
kubectl logs deployment/notification-service -n vacademy | grep "Received WATI webhook"
```

### 6.3 Verify Webhook Endpoint

```bash
curl -X GET "http://localhost:8076/notification-service/whatsapp/v1/wati-webhook/health"
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-09-30T10:30:00"
}
```

---

## 📊 Step 7: Production Rollout

### 7.1 Pre-Rollout Checklist

- [ ] All templates approved in WATI
- [ ] API credentials configured correctly
- [ ] Tested with 5-10 test users successfully
- [ ] Logs are being collected and monitored
- [ ] Webhooks configured and tested
- [ ] Fallback mechanism in place (Email/SMS)
- [ ] Support team trained on troubleshooting
- [ ] Documentation updated

### 7.2 Gradual Rollout Strategy

**Phase 1: Pilot (Day 1-3)**
- Enable for 50 users
- Monitor delivery rates (target: >95%)
- Collect user feedback
- Fix any issues

**Phase 2: Limited (Day 4-7)**
- Enable for 500 users
- Monitor system performance
- Check WATI account limits
- Optimize if needed

**Phase 3: Full Rollout (Day 8+)**
- Enable for all users
- Continue monitoring
- Set up alerts for failures

### 7.3 Monitoring Metrics

**Key Metrics to Track:**

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Delivery Rate | >95% | <90% |
| Average Delivery Time | <5 seconds | >30 seconds |
| Failed Message Rate | <5% | >10% |
| API Response Time | <2 seconds | >5 seconds |

### 7.4 Set Up Alerts

**Create alerts for:**
- Delivery rate drops below 90%
- Failed message rate exceeds 10%
- API errors increase
- WATI account balance low

---

## 🆘 Troubleshooting Guide

### Issue 1: Messages Not Sending

**Symptoms:** API returns success but messages not received

**Checklist:**
1. ✅ Check template is approved
2. ✅ Verify phone number format (with country code)
3. ✅ Check WATI account balance/credits
4. ✅ Verify API key is correct
5. ✅ Check recipient has WhatsApp installed
6. ✅ Verify recipient hasn't blocked business number

**Debug:**
```bash
# Check WATI logs in dashboard
# Check notification service logs
kubectl logs deployment/notification-service -n vacademy | grep -A 5 "WATI"
```

### Issue 2: Template Rejected

**Symptoms:** Template stuck in "Pending Approval" or "Rejected"

**Common Reasons:**
- Contains promotional content (use UTILITY category)
- Too many variables
- Incorrect formatting
- Violates WhatsApp policies

**Solution:**
1. Review WhatsApp Business Policy
2. Simplify template
3. Remove promotional language
4. Resubmit for approval

### Issue 3: High Failure Rate

**Symptoms:** >10% of messages failing

**Analysis:**
```sql
SELECT 
    error_message,
    COUNT(*) as count
FROM recipient_messages
WHERE medium_type = 'WHATSAPP'
AND status = 'FAILED'
AND created_at >= NOW() - INTERVAL '1 day'
GROUP BY error_message
ORDER BY count DESC;
```

**Common Fixes:**
- Invalid numbers: Improve phone validation
- Template issues: Verify template name and params
- Rate limiting: Implement exponential backoff

### Issue 4: Slow Delivery

**Symptoms:** Messages taking >1 minute to deliver

**Checklist:**
1. Check WATI server status
2. Verify network connectivity
3. Check for rate limiting
4. Review batch sizes

**Optimization:**
- Implement async processing
- Use batch APIs where available
- Optimize database queries

---

## 📈 Best Practices

### 1. Phone Number Management

**✅ DO:**
- Store numbers with country code (e.g., `919876543210`)
- Validate format before sending
- Remove invalid numbers from lists
- Handle international formats

**❌ DON'T:**
- Store with spaces or hyphens
- Skip validation
- Send to landline numbers
- Include special characters

### 2. Template Management

**✅ DO:**
- Use versioning (template_v1, template_v2)
- Test thoroughly before approval
- Keep templates simple and clear
- Document parameter mappings

**❌ DON'T:**
- Use overly complex templates
- Include URLs without proper formatting
- Exceed character limits
- Use too many variables

### 3. Rate Limiting

**✅ DO:**
- Implement exponential backoff
- Batch requests where possible
- Monitor API usage
- Plan for peak times

**❌ DON'T:**
- Send all messages at once
- Ignore rate limit errors
- Overwhelm users with messages

### 4. Error Handling

**✅ DO:**
- Log all errors with context
- Retry transient failures
- Alert on critical failures
- Provide fallback options

**❌ DON'T:**
- Ignore errors silently
- Retry indefinitely
- Skip logging
- Leave users uninformed

---

## 📞 Support and Resources

### WATI Resources
- Documentation: https://docs.wati.io
- API Reference: https://docs.wati.io/reference
- Support: support@wati.io
- Status Page: https://status.wati.io

### WhatsApp Business
- Policy: https://www.whatsapp.com/legal/business-policy
- Template Guidelines: https://developers.facebook.com/docs/whatsapp/message-templates/guidelines

### Internal
- Notification Service Documentation: `API_README.md`
- Institute Settings Guide: `INSTITUTE_SETTINGS_GUIDE.md`
- WATI Integration Guide: `WATI_INTEGRATION_GUIDE.md`

---

## ✅ Verification Checklist

Before marking integration complete:

- [ ] WATI account set up and verified
- [ ] At least 3 templates created and approved
- [ ] API credentials configured in settings
- [ ] Direct API test successful
- [ ] Announcement system test successful
- [ ] Bulk send test successful (10+ users)
- [ ] Webhooks configured and tested
- [ ] Monitoring and alerts set up
- [ ] Error handling tested
- [ ] Documentation updated
- [ ] Team trained on system
- [ ] Production rollout plan created

---

**Version:** 1.0  
**Last Updated:** September 30, 2025  
**Maintained By:** Platform Team
