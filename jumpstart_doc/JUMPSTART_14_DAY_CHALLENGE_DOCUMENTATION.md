# Jumpstart 14-Day Challenge - Technical Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [Lead Capture Flow](#lead-capture-flow)
5. [Zoho Forms Integration](#zoho-forms-integration)
6. [Workflow Engine](#workflow-engine)
7. [WhatsApp Integration](#whatsapp-integration)
8. [Scheduling System](#scheduling-system)
9. [Node Types & Configuration](#node-types--configuration)
10. [API Reference](#api-reference)
11. [Configuration Guide](#configuration-guide)
12. [Notification Service Architecture](#notification-service-architecture)

---

## Project Overview

### Business Context
Jumpstart is a **14-day parenting challenge** program designed to engage new leads through a structured WhatsApp messaging campaign. The system automatically sends daily challenges and follow-up messages to participants based on their registration date.

### Key Features
- **Multi-Center Support**: 13 physical centers + 1 referral channel
- **Automated WhatsApp Messaging**: 
  - Morning messages at **9:00 AM** (challenge content)
  - Evening messages at **6:00 PM** (completion check/follow-up)
- **Age-Based Levels**: Three difficulty levels based on child's age
  - Level 1: Children < 2 years
  - Level 2: Children 2-4 years
  - Level 3: Children > 4 years
- **Multi-Provider Support**: Generic WhatsApp integration supporting both **Combot** and **WATI**
- **Certificate Generation**: Automatic certificate for challenge completers

### Challenge Structure
```
Day 0  → Welcome message (immediately on registration)
Day 1  → Challenge Day 1 content (AM) + Completion check (PM)
Day 2  → Challenge Day 2 content (AM) + Completion check (PM)
...
Day 11 → Challenge Day 11 content (AM) + Completion check (PM)
Day 14 → Certificate (for those who completed 11+ challenges)
```

---

## System Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌────────────────────┐    ┌──────────────────────┐
│   Zoho Forms    │───▶│  Form Webhook API  │───▶│  Audience Response   │
│   (13 Centers)  │    │  (Admin Core Svc)  │    │  Storage             │
└─────────────────┘    └────────────────────┘    └──────────────────────┘
                                                           │
                                                           ▼
┌─────────────────┐    ┌────────────────────┐    ┌──────────────────────┐
│  CRON Scheduler │───▶│  Workflow Engine   │───▶│  WhatsApp Provider   │
│  (9AM / 6PM)    │    │  (Node Execution)  │    │  (Combot / WATI)     │
└─────────────────┘    └────────────────────┘    └──────────────────────┘
```

### Services Involved
| Service | Responsibility |
|---------|----------------|
| `admin_core_service` | Audience management, Workflow engine, Lead capture |
| `notification_service` | WhatsApp message delivery, Provider abstraction |

---

## Database Schema

### Core Tables Overview

```
┌─────────────────────┐
│      audience       │ ←── Campaign/Form configuration
├─────────────────────┤
│ id                  │
│ institute_id        │
│ campaign_name       │
│ setting_json        │ ←── Contains offset_day for workflow timing
│ session_id          │
└─────────────────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐
│  audience_response  │ ←── Lead submissions
├─────────────────────┤
│ id                  │
│ audience_id         │
│ user_id             │
│ parent_name         │
│ parent_email        │
│ parent_mobile       │
│ workflow_activate_  │ ←── Date used for day-difference filtering
│ day_at              │
└─────────────────────┘

┌─────────────────────┐
│form_webhook_connector│ ←── Maps external forms to audiences
├─────────────────────┤
│ id                  │
│ vendor_id           │ ←── Unique ID from form provider (e.g., Zoho form ID)
│ vendor              │ ←── ZOHO_FORMS, GOOGLE_FORMS, etc.
│ audience_id         │
│ institute_id        │
│ sample_map_json     │ ←── Field name mapping configuration
└─────────────────────┘
```

### Workflow Tables

```
┌─────────────────────┐
│      workflow       │ ←── Workflow definitions
├─────────────────────┤
│ id                  │
│ name                │ ←── e.g., "little_win_day_1_level_1"
│ workflow_type       │ ←── SCHEDULED, MANUAL
│ status              │
│ institute_id        │
└─────────────────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐
│workflow_node_mapping│ ←── Maps workflows to node templates
├─────────────────────┤
│ id                  │
│ workflow_id         │
│ node_template_id    │
│ node_order          │
│ is_start_node       │
│ is_end_node         │
└─────────────────────┘
          │
          │ N:1
          ▼
┌─────────────────────┐
│    node_template    │ ←── Reusable workflow node definitions
├─────────────────────┤
│ id                  │
│ node_name           │
│ node_type           │ ←── QUERY, TRANSFORM, SEND_WHATSAPP, HTTP_REQUEST, TRIGGER
│ config_json         │ ←── Node-specific configuration
│ institute_id        │
└─────────────────────┘

┌─────────────────────┐
│  workflow_schedule  │ ←── CRON-based scheduling
├─────────────────────┤
│ id                  │
│ workflow_id         │
│ schedule_type       │ ←── CRON
│ cron_expr           │ ←── e.g., "0 0 9 * * ?" for 9AM
└─────────────────────┘

┌─────────────────────┐
│  workflow_trigger   │ ←── Event-based triggers
├─────────────────────┤
│ id                  │
│ workflow_id         │
│ trigger_event_name  │ ←── AUDIENCE_LEAD_SUBMISSION
│ event_id            │ ←── Specific audience_id to trigger on
│ institute_id        │
└─────────────────────┘
```

---

## Lead Capture Flow

### Step 1: Form Submission
When a lead fills out a Zoho form at any Jumpstart center:

```
┌────────────────┐
│  Zoho Form     │
│  (Center XYZ)  │
└───────┬────────┘
        │ Webhook POST
        ▼
┌────────────────────────────────────────────────────────────────┐
│ POST /admin-core-service/api/v1/audience/webhook/form          │
│ Headers: X-Vendor-ID: <center_specific_zoho_form_id>           │
│ Body: { form submission data }                                  │
└────────────────────────────────────────────────────────────────┘
```

### Step 2: Vendor ID Resolution
The `FormWebhookService` uses the `X-Vendor-ID` header to:
1. Look up the `form_webhook_connector` table
2. Identify which `audience_id` this form belongs to
3. Apply field mapping from `sample_map_json`

```java
// FormWebhookController.java
@PostMapping("/form")
public ResponseEntity<String> handleFormWebhook(
        @RequestBody Map<String, Object> payload,
        @RequestHeader(value = "X-Vendor-ID", required = true) String vendorId) {
    String responseId = formWebhookService.processFormWebhookByVendorId(vendorId, payload);
    return ResponseEntity.ok(responseId);
}
```

### Step 3: Response Storage
The lead data is stored in `audience_response` table with:
- `workflow_activate_day_at`: Calculated from `created_at` + `offset_day` (from `audience.setting_json`)
- This date is used to determine which day's workflow the lead should receive

### Step 4: Workflow Triggering (Referral Only)
For referral submissions (`audience_id = 938f447a-d0a7-4219-b101-863b25272654`), the `workflow_trigger` table triggers the `day_1_workflow_2` immediately.

---

## Zoho Forms Integration

### Overview
All 13 Jumpstart centers use **Zoho Forms** as the primary lead capture mechanism. When parents register for the 14-day challenge at any center, their information flows through Zoho Forms → Webhook → Admin Core Service → Database → Workflow Engine.

### Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Parent fills Zoho Form at Center (e.g., Viman Nagar)      │
│  Fields: parent name, phone, children name, center name             │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Zoho Forms sends webhook POST                              │
│  POST https://backend.vacademy.io/admin-core-service/api/v1/        │
│       audience/webhook/form                                         │
│  Header: X-Vendor-ID: <zoho_form_unique_id>                        │
│  Body: { "parent name": "John", "phone": "919876543210", ... }     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: FormWebhookController receives webhook                     │
│  - Extracts X-Vendor-ID from header                                │
│  - Looks up form_webhook_connector table                           │
│  - Identifies audience_id for this center                          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: Field Mapping Applied                                      │
│  sample_map_json:                                                   │
│  {                                                                  │
│    "parent name": "parentName",      (Zoho field → DB field)      │
│    "phone": "phone",                                               │
│    "children name": "childrenName",                               │
│    "center name": "centerName"                                     │
│  }                                                                  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 5: Data Stored in audience_response                          │
│  - parent_name: "John"                                             │
│  - parent_mobile: "919876543210"                                   │
│  - audience_id: <viman_nagar_audience_id>                         │
│  - workflow_activate_day_at: CURRENT_DATE + offset_day            │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 6: Workflow Triggered (if configured)                        │
│  - For Referral center: Immediate Day 0 welcome message            │
│  - For other centers: Scheduled workflows start next day           │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Zoho Forms Setup Guide

#### Prerequisites
1. Zoho Forms account with API access
2. Admin access to create/modify forms
3. Admin Core Service webhook endpoint accessible from internet
4. Database access to configure `form_webhook_connector`

---

#### Step 1: Create Zoho Form

**Required Form Fields:**

| Field Name (Zoho) | Field Type | Required | Validation | Example |
|-------------------|------------|----------|------------|----------|
| `parent name` | Single Line | ✅ Yes | Min 2 chars | "Priya Sharma" |
| `phone` | Phone Number | ✅ Yes | Indian format (10 digits) | "9876543210" |
| `children name` | Single Line | ✅ Yes | Min 2 chars | "Aarav" |
| `center name` | Dropdown | ✅ Yes | Fixed values | "Viman Nagar" |
| `child age` | Number | ❌ Optional | 0-18 | "3" |
| `email` | Email | ❌ Optional | Email format | "priya@example.com" |

**Important Notes:**
- Field names in Zoho **must match exactly** (case-sensitive) with `sample_map_json` configuration
- Phone field should accept country code (91 for India)
- Center name dropdown should list all active centers

---

#### Step 2: Configure Zoho Webhook

**In Zoho Forms:**

1. Open your Jumpstart form
2. Go to **Settings** → **Integrations** → **Webhooks**
3. Click **Add Webhook**
4. Configure webhook:

```
Webhook Name: Jumpstart Lead Capture
Webhook URL: https://backend.vacademy.io/admin-core-service/api/v1/audience/webhook/form
Method: POST
Format: JSON
Headers:
  - Key: X-Vendor-ID
    Value: <your_zoho_form_id>  (e.g., "zoho_form_viman_nagar_001")
  - Key: Content-Type
    Value: application/json
```

**How to find Zoho Form ID:**
- Go to Zoho Forms → Your Form → Settings → Form ID
- Or use a unique identifier like "jumpstart_viman_nagar" (must be unique per center)

**Webhook Trigger:**
- Set to trigger on **"On Form Submission"**
- Do NOT trigger on draft saves

---

#### Step 3: Configure Database Mapping

**Create `form_webhook_connector` Entry:**

```sql
INSERT INTO form_webhook_connector (
    id,
    vendor_id,
    vendor,
    institute_id,
    audience_id,
    sample_map_json,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'zoho_form_viman_nagar_001',                    -- Must match X-Vendor-ID header
    'ZOHO_FORMS',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',        -- Jumpstart institute ID
    '09f6d308-bed4-454b-8a70-e95a66c0cffd',        -- Viman Nagar audience ID
    '{
        "parent name": "parentName",
        "phone": "phone",
        "children name": "childrenName",
        "center name": "centerName",
        "child age": "childAge",
        "email": "parentEmail"
    }'::jsonb,
    true,
    NOW(),
    NOW()
);
```

**Field Mapping Explanation:**

| Zoho Form Field | Database Column | Purpose |
|-----------------|-----------------|----------|
| `parent name` | `parent_name` | Stored in `audience_response.user_details` JSON |
| `phone` | `parent_mobile` | Used for WhatsApp messaging |
| `children name` | `child_name` | Used in template variables |
| `center name` | `metadata` (optional) | For analytics |
| `child age` | `metadata` (optional) | For level assignment |
| `email` | `parent_email` | For email workflows |

---

#### Step 4: Create Audience Entry

```sql
INSERT INTO audience (
    id,
    institute_id,
    campaign_name,
    status,
    setting_json,
    session_id,
    created_at,
    updated_at
) VALUES (
    '09f6d308-bed4-454b-8a70-e95a66c0cffd',        -- New UUID for Viman Nagar
    '757d50c5-4e0a-4758-9fc6-ee62479df549',        -- Jumpstart institute ID
    'Jumpstart - Viman Nagar',
    'ACTIVE',
    '{"offset_day": 0}'::jsonb,                     -- Start workflows immediately
    NULL,
    NOW(),
    NOW()
);
```

**Setting JSON Options:**
- `offset_day: 0` → Workflows start same day as registration
- `offset_day: 1` → Workflows start next day (recommended)

---

### Testing Zoho Integration

#### Manual Testing Steps

**1. Submit Test Form:**
```
Parent Name: Test User
Phone: 919999999999
Children Name: Test Child
Center Name: Viman Nagar
```

**2. Check Webhook Delivery in Zoho:**
- Zoho Forms → Form → Responses → View Webhooks
- Verify webhook was sent (status 200 OK)

**3. Check Database:**
```sql
-- Check if response was created
SELECT 
    id,
    audience_id,
    user_details->>'parentName' as parent_name,
    user_details->>'phone' as phone,
    workflow_activate_day_at,
    created_at
FROM audience_response
WHERE user_details->>'phone' = '919999999999'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
- New record created in `audience_response`
- `audience_id` matches Viman Nagar
- `workflow_activate_day_at` = `created_at` + `offset_day`

**4. Check Workflow Trigger (Referral Only):**
```sql
-- For referral audience, check if immediate workflow was triggered
SELECT *
FROM workflow_execution_log
WHERE context_json::text LIKE '%919999999999%'
ORDER BY created_at DESC
LIMIT 1;
```

---

### Field Mapping Configuration

#### Standard Field Mapping

```json
{
  "parent name": "parentName",
  "phone": "phone",
  "children name": "childrenName",
  "center name": "centerName"
}
```

#### Extended Field Mapping (with optional fields)

```json
{
  "parent name": "parentName",
  "phone": "phone",
  "children name": "childrenName",
  "center name": "centerName",
  "child age": "childAge",
  "email": "parentEmail",
  "preferred language": "preferredLanguage",
  "referral source": "referralSource",
  "additional notes": "notes"
}
```

#### Custom Processing Rules

**Phone Number Normalization:**
The system automatically handles:
- Adds country code if missing: `9876543210` → `919876543210`
- Removes spaces/dashes: `98765-43210` → `9876543210`
- Validates format: Must be 10 digits (India)

**Date/Time Handling:**
- `workflow_activate_day_at` is auto-calculated:
  ```
  workflow_activate_day_at = submission_timestamp + offset_day (from audience.setting_json)
  ```

---

### Adding New Center with Zoho Form

#### Complete Checklist

**Step 1: Create Zoho Form**
- [ ] Clone existing Jumpstart form template
- [ ] Update form title: "Jumpstart Challenge - [Center Name]"
- [ ] Verify all required fields present
- [ ] Test form submission manually

**Step 2: Configure Webhook**
- [ ] Add webhook in Zoho Forms settings
- [ ] Set URL: `https://backend.vacademy.io/admin-core-service/api/v1/audience/webhook/form`
- [ ] Add header: `X-Vendor-ID: zoho_form_[center_name]_001`
- [ ] Test webhook delivery

**Step 3: Database Configuration**

```sql
-- 1. Create audience entry
INSERT INTO audience (id, institute_id, campaign_name, status, setting_json)
VALUES (
    gen_random_uuid(),  -- Save this UUID for next steps
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    'Jumpstart - [Center Name]',
    'ACTIVE',
    '{"offset_day": 0}'::jsonb
);

-- 2. Create form webhook connector
INSERT INTO form_webhook_connector (
    id, vendor_id, vendor, institute_id, audience_id, sample_map_json, is_active
)
VALUES (
    gen_random_uuid(),
    'zoho_form_[center_name]_001',  -- Must match X-Vendor-ID
    'ZOHO_FORMS',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    '<audience_id_from_step_1>',
    '{
        "parent name": "parentName",
        "phone": "phone",
        "children name": "childrenName",
        "center name": "centerName"
    }'::jsonb,
    true
);

-- 3. Update workflow nodes to include new audience_id
UPDATE node_template
SET config_json = jsonb_set(
    config_json,
    '{params,audienceId}',
    concat(
        config_json->'params'->>'audienceId',
        ',<new_audience_id>'
    )::jsonb
)
WHERE node_type = 'QUERY'
  AND node_name LIKE '%jumpstart%';
```

**Step 4: Testing**
- [ ] Submit test form
- [ ] Verify webhook delivery (200 OK)
- [ ] Check `audience_response` table for new record
- [ ] Wait for scheduled workflow execution
- [ ] Verify WhatsApp message sent to test number

---

### Zoho Forms Best Practices

#### Form Design
1. **Keep it Simple**: Only ask essential fields (parent name, phone, child name, center)
2. **Mobile Optimization**: Most users fill from mobile devices
3. **Clear Labels**: Use "Parent's Name" instead of just "Name"
4. **Validation**: Enable phone number format validation
5. **Confirmation Page**: Show success message after submission

#### Webhook Reliability
1. **Retry Logic**: Zoho retries failed webhooks up to 3 times
2. **Timeout**: Set webhook timeout to 10 seconds
3. **Monitoring**: Check Zoho webhook logs daily for failures
4. **Fallback**: Have manual import process for webhook failures

#### Security
1. **HTTPS Only**: Never use HTTP for webhook URLs
2. **Header Authentication**: Always include `X-Vendor-ID` header
3. **IP Whitelisting**: Consider whitelisting Zoho's IP ranges
4. **Rate Limiting**: Implement rate limiting on webhook endpoint

---

### Troubleshooting Zoho Integration

#### Issue 1: Webhook Not Triggering

**Symptoms:**
- Form submitted in Zoho
- No record in `audience_response` table
- Zoho webhook logs show "Failed" status

**Diagnosis:**
```sql
-- Check if form_webhook_connector exists
SELECT *
FROM form_webhook_connector
WHERE vendor_id = 'zoho_form_viman_nagar_001'
  AND is_active = true;
```

**Solutions:**
1. **Check Webhook URL**: Verify URL is correct in Zoho settings
2. **Check X-Vendor-ID**: Must match `vendor_id` in database exactly
3. **Check Network**: Ensure webhook endpoint is publicly accessible
4. **Check Logs**: Review admin-core-service logs for errors

```bash
# Check recent webhook errors
tail -f /var/log/admin-core-service/application.log | grep "FormWebhookController"
```

---

#### Issue 2: Wrong Audience Mapping

**Symptoms:**
- Lead created but in wrong audience
- User receives workflows for different center

**Diagnosis:**
```sql
-- Check audience mapping
SELECT 
    fwc.vendor_id,
    fwc.audience_id,
    a.campaign_name
FROM form_webhook_connector fwc
JOIN audience a ON a.id = fwc.audience_id
WHERE fwc.vendor_id = 'zoho_form_viman_nagar_001';
```

**Solutions:**
1. Update `audience_id` in `form_webhook_connector`:
```sql
UPDATE form_webhook_connector
SET audience_id = '<correct_audience_id>'
WHERE vendor_id = 'zoho_form_viman_nagar_001';
```

---

#### Issue 3: Field Mapping Errors

**Symptoms:**
- Lead created but some fields are NULL
- Parent name or phone missing

**Diagnosis:**
```sql
-- Check recent responses for NULL fields
SELECT 
    id,
    audience_id,
    user_details,
    created_at
FROM audience_response
WHERE audience_id = '09f6d308-bed4-454b-8a70-e95a66c0cffd'
ORDER BY created_at DESC
LIMIT 5;
```

**Common Causes:**
1. **Field Name Mismatch**: Zoho field name ≠ `sample_map_json` key
   - Zoho: `"Parent Name"` (capital P, N)
   - Mapping: `"parent name"` (lowercase)
   - **Solution**: Update `sample_map_json` to match exact Zoho field names

2. **Missing Required Fields**: Form submitted without required data
   - **Solution**: Enable "Required" validation in Zoho Forms

**Fix Field Mapping:**
```sql
UPDATE form_webhook_connector
SET sample_map_json = '{
    "Parent Name": "parentName",
    "Phone": "phone",
    "Children Name": "childrenName",
    "Center Name": "centerName"
}'::jsonb
WHERE vendor_id = 'zoho_form_viman_nagar_001';
```

---

#### Issue 4: Phone Number Format Issues

**Symptoms:**
- WhatsApp messages not sent
- Phone number stored incorrectly

**Diagnosis:**
```sql
SELECT 
    user_details->>'phone' as phone,
    LENGTH(user_details->>'phone') as phone_length
FROM audience_response
WHERE user_details->>'phone' IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Format:** `919876543210` (12 digits with country code)

**Solutions:**
1. **Zoho Form Configuration**:
   - Set phone field type to "Phone Number"
   - Set country code to India (+91)
   - Enable format validation

2. **Backend Normalization**: Update form webhook service to auto-add country code

---

#### Issue 5: Duplicate Submissions

**Symptoms:**
- Same lead appears multiple times
- User receives duplicate welcome messages

**Diagnosis:**
```sql
SELECT 
    user_details->>'phone' as phone,
    COUNT(*) as submission_count,
    MIN(created_at) as first_submission,
    MAX(created_at) as last_submission
FROM audience_response
WHERE audience_id = '09f6d308-bed4-454b-8a70-e95a66c0cffd'
GROUP BY user_details->>'phone'
HAVING COUNT(*) > 1
ORDER BY submission_count DESC;
```

**Solutions:**
1. **Zoho Form Settings**: Enable "Prevent Duplicate Submissions" based on email/phone
2. **Database Constraint**: Add unique constraint on phone + audience_id
3. **Application Logic**: Implement deduplication in webhook handler

---

### Zoho Webhook Payload Examples

#### Standard Submission Payload

```json
{
  "parent name": "Priya Sharma",
  "phone": "9876543210",
  "children name": "Aarav",
  "center name": "Viman Nagar",
  "child age": "3",
  "email": "priya.sharma@example.com",
  "submission_time": "2026-02-09T10:30:00Z",
  "form_id": "zoho_form_viman_nagar_001"
}
```

#### Headers Received

```http
POST /admin-core-service/api/v1/audience/webhook/form HTTP/1.1
Host: backend.vacademy.io
Content-Type: application/json
X-Vendor-ID: zoho_form_viman_nagar_001
User-Agent: ZohoForms/1.0
Content-Length: 245
```

---

### Multi-Center Zoho Configuration Reference

| Center Name | Vendor ID | Audience ID | Zoho Form URL |
|-------------|-----------|-------------|---------------|
| Bibwewadi | `zoho_form_bibwewadi_001` | `7125ee0e-85f7-4475-a845-409421793df2` | `https://forms.zohopublic.in/vacademy/form/JumpstartBibwewadi` |
| Viman Nagar | `zoho_form_viman_nagar_001` | `09f6d308-bed4-454b-8a70-e95a66c0cffd` | `https://forms.zohopublic.in/vacademy/form/JumpstartVimanNagar` |
| Wakad | `zoho_form_wakad_001` | `cc8e2535-5e5a-49a2-82f3-312afc4ed6c7` | `https://forms.zohopublic.in/vacademy/form/JumpstartWakad` |
| Hinjewadi | `zoho_form_hinjewadi_001` | `8bcb8aaa-5477-488a-98a8-1cc4d2a331a9` | `https://forms.zohopublic.in/vacademy/form/JumpstartHinjewadi` |
| Karve Road | `zoho_form_karve_road_001` | `84454ecf-d40b-4216-b4aa-01feb2c1df3f` | `https://forms.zohopublic.in/vacademy/form/JumpstartKarveRoad` |
| Baner | `zoho_form_baner_001` | `58f17610-ec22-42f7-8782-1cf02af8f45c` | `https://forms.zohopublic.in/vacademy/form/JumpstartBaner` |
| Pashan | `zoho_form_pashan_001` | `264fb655-6058-4a62-9821-69bb984bd3f2` | `https://forms.zohopublic.in/vacademy/form/JumpstartPashan` |
| Nayati | `zoho_form_nayati_001` | `48995e06-476f-42e0-8dad-3b27b2d996dc` | `https://forms.zohopublic.in/vacademy/form/JumpstartNayati` |
| Kalyani Nagar | `zoho_form_kalyani_nagar_001` | `3e03a4b5-b079-4e8d-8886-0ff2b231715a` | `https://forms.zohopublic.in/vacademy/form/JumpstartKalyaniNagar` |
| Magarpatta | `zoho_form_magarpatta_001` | `6b3cb024-aa14-4226-a485-18c50e4c39b3` | `https://forms.zohopublic.in/vacademy/form/JumpstartMagarpatta` |
| Koramangala | `zoho_form_koramangala_001` | `7ae98465-4faa-47b9-aa0e-3edf6b97f205` | `https://forms.zohopublic.in/vacademy/form/JumpstartKoramangala` |
| Pimple Saudagar | `zoho_form_pimple_saudagar_001` | `1333ddb7-33e0-4451-9b62-efd9fc5bf838` | `https://forms.zohopublic.in/vacademy/form/JumpstartPimpleSaudagar` |
| Referral Invite | `zoho_form_referral_001` | `938f447a-d0a7-4219-b101-863b25272654` | `https://forms.zohopublic.in/vacademy/form/JumpstartReferral` |

---

## Workflow Engine

### Workflow Types
The Jumpstart project uses the following workflow categories:

| Category | Example Workflow Names | Schedule |
|----------|----------------------|----------|
| Day 0 (Welcome) | `wf_audience_email_01` | Triggered on submission |
| Day 1-11 Level 1 | `little_win_day_1_level_1` to `little_win_day_11_level_1` | 9:00 AM |
| Day 1-11 Level 2 | `little_win_day_1_level_2` to `little_win_day_11_level_2` | 9:00 AM |
| Day 1-11 Level 3 | `little_win_day_1_level_3` to `little_win_day_11_level_3` | 9:00 AM |
| PM Follow-ups | `little_win_day_1_pm` to `little_win_day_11_pm` | 6:00 PM |
| Catch-up | `little_win_day_5_level_1_catch_up` | 8:00 PM |
| Certificate | `js_certificate` | 9:00 AM |
| Inactivity | `2_day_inactivity_workflow` | As scheduled |

### Workflow Execution Flow

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  HTTP_REQUEST │────▶│    QUERY      │────▶│   TRANSFORM   │────▶│ SEND_WHATSAPP │
│  (Filter users│     │ (Get leads by │     │ (Build message│     │ (Send WhatsApp│
│   by response)│     │  day offset)  │     │   payload)    │     │   messages)   │
└───────────────┘     └───────────────┘     └───────────────┘     └───────────────┘
```

### Node Routing
Each node can define routing rules in `config_json`:
```json
{
  "routing": [
    { "type": "goto", "targetNodeId": "next_node_id" }
  ]
}
```

---

## WhatsApp Integration

### Provider Abstraction
The system supports multiple WhatsApp Business API providers:

| Provider | Status | Configuration |
|----------|--------|---------------|
| Combot | Supported | Via `SEND_WHATSAPP` node type |
| WATI | Supported | Via `SEND_WHATSAPP` node type |

> **Note:** Both providers now use the unified `SEND_WHATSAPP` node type. The provider selection is handled by the notification service based on institute configuration.

### Message Template Structure
```json
{
  "userId": "user_id_or_guest_id",
  "to": "phone_number",
  "templateName": "little_win_day_1_level_1",
  "languageCode": "en",
  "headerImage": "https://...",
  "params": {
    "parent_name": "John",
    "children_name": "Jane"
  }
}
```

### Level Selection Logic
Users are assigned to levels based on their response to the `challenge_confirmation` message:
- **LEVEL 1 (<2 YEARS)**: Children under 2 years old
- **LEVEL 2 (2-4 YEARS)**: Children between 2-4 years old
- **LEVEL 3 (>4 YEARS)**: Children over 4 years old

The `filter-adjacent-sequence` API filters users based on their response:
```json
{
  "anchorMessageType": "WHATSAPP_MESSAGE_OUTGOING",
  "anchorMessageBody": "challenge_confirmation",
  "reactionMessageType": "WHATSAPP_MESSAGE_INCOMING",
  "reactionMessageBody": "LEVEL 1 (<2 YEARS)"
}
```

---

## Scheduling System

### CRON Expressions Used

| Schedule ID | Workflow | CRON Expression | Time |
|-------------|----------|-----------------|------|
| js_day_01 | day_1_workflow | `0 0 9 * * ?` | 9:00 AM daily |
| js_day_02 | day_2_workflow | `0 0 9 * * ?` | 9:00 AM daily |
| js_day_03_level_1 | little_win_day_1_level_1 | `0 0 9 * * ?` | 9:00 AM daily |
| js_day_01_pm | little_win_day_1_pm | `0 0 18 * * ?` | 6:00 PM daily |
| js_certificate | js_certificate | `0 0 9 * * ?` | 9:00 AM daily |
| js_day_05_level_1_catch_up | little_win_day_5_level_1_catch_up | `0 0 20 * * ?` | 8:00 PM daily |

### Day Offset Calculation
The workflow selects users based on `workflow_activate_day_at` field:

```sql
-- Example: Get leads who started 3 days ago for Day 1 challenge
SELECT * FROM audience_response 
WHERE audience_id IN ('center_ids...')
AND DATE(workflow_activate_day_at) = CURRENT_DATE - INTERVAL '3 days'
```

### Day-to-Offset Mapping (Challenge Days)
| Challenge Day | Days Since Registration | Description |
|---------------|------------------------|-------------|
| Day 0 | 0 | Welcome message |
| Day 1 | 1 | First challenge content |
| Day 2 | 2 | Second challenge content |
| ... | ... | ... |
| Day 11 | 13 | Final challenge content |
| Certificate | 14 | Certificate for completers |

---

## Node Types & Configuration

### 1. QUERY Node
Fetches data from the database using prebuilt queries.

```json
{
  "prebuiltKey": "getAudienceResponsesByDayDifference",
  "params": {
    "instituteId": "#ctx['instituteId']",
    "audienceId": "'center_id_1,center_id_2,...'",
    "daysAgo": 3
  },
  "routing": [
    { "type": "goto", "targetNodeId": "transform_node_id" }
  ]
}
```

### 2. HTTP_REQUEST Node
Makes external API calls for filtering users.

```json
{
  "resultKey": "'valid_sequence_users'",
  "config": {
    "requestType": "EXTERNAL",
    "method": "POST",
    "url": "'https://backend-stage.vacademy.io/notification-service/v1/combot/filter-adjacent-sequence'",
    "body": {
      "anchorMessageType": "WHATSAPP_MESSAGE_OUTGOING",
      "anchorMessageBody": "challenge_confirmation",
      "reactionMessageType": "WHATSAPP_MESSAGE_INCOMING",
      "reactionMessageBody": "LEVEL 1 (<2 YEARS)"
    }
  },
  "routing": [
    { "type": "goto", "targetNodeId": "query_node_id" }
  ]
}
```

### 3. TRANSFORM Node
Transforms lead data into WhatsApp message payloads.

```json
{
  "outputDataPoints": [
    {
      "fieldName": "combotRequestList",
      "compute": "#ctx['leads']?.?[ #ctx['valid_sequence_users'] != null && #ctx['valid_sequence_users']['body'] != null && #ctx['valid_sequence_users']['body'].contains(#this['userId']) ]?.![ { 'userId': ..., 'to': #this['phone'], 'templateName': 'little_win_day_1_level_1', ... } ]"
    }
  ],
  "routing": [
    { "type": "goto", "targetNodeId": "send_node_id" }
  ]
}
```

### 4. SEND_WHATSAPP Node
Sends WhatsApp messages to the filtered users. This is the unified node type for all WhatsApp providers (Combot, WATI).

**Node Type:** `SEND_WHATSAPP`

```json
{
  "on": "#ctx['combotRequestList']",
  "forEach": {
    "eval": "#ctx['item']"
  },
  "routing": []
}
```

### 5. TRIGGER Node
Initializes workflow context with configuration.

```json
{
  "outputDataPoints": [
    {
      "fieldName": "emailTemplateName",
      "value": "test_template_tap"
    }
  ],
  "routing": [
    { "type": "goto", "targetNodeId": "next_node_id" }
  ]
}
```

---

## API Reference

### Form Webhook API
```http
POST /admin-core-service/api/v1/audience/webhook/form
Content-Type: application/json
X-Vendor-ID: <zoho_form_id>

{
  "parent name": "John Doe",
  "phone": "919876543210",
  "children name": "Jane Doe",
  "center name": "Viman Nagar"
}
```

**Response:**
```json
"response_id_uuid"
```

### Filter Adjacent Sequence API
```http
POST /notification-service/v1/combot/filter-adjacent-sequence
Content-Type: application/json

{
  "anchorMessageType": "WHATSAPP_MESSAGE_OUTGOING",
  "anchorMessageBody": "challenge_confirmation",
  "reactionMessageType": "WHATSAPP_MESSAGE_INCOMING",
  "reactionMessageBody": "LEVEL 1 (<2 YEARS)"
}
```

### Filter Users by Messages API (Certificate)
```http
POST /notification-service/v1/combot/filter-users-by-messages
Content-Type: application/json

{
  "messageList": [
    "COMPLETED CHALLENGE 1",
    "COMPLETED CHALLENGE 2",
    ...
    "COMPLETED CHALLENGE 11"
  ],
  "messageType": "WHATSAPP_MESSAGE_INCOMING",
  "senderBusinessChannelId": "935184396337916"
}
```

---

## Configuration Guide

### Adding a New Center

1. **Create Audience Entry**
```sql
INSERT INTO audience (id, institute_id, campaign_name, status, setting_json)
VALUES (
  'new-center-uuid',
  'jumpstart-institute-id',
  'Jumpstart New Center',
  'ACTIVE',
  '{"offset_day": 0}'
);
```

2. **Create Form Webhook Connector**
```sql
INSERT INTO form_webhook_connector (
  vendor_id, vendor, institute_id, audience_id, sample_map_json, is_active
) VALUES (
  'zoho-form-id-for-new-center',
  'ZOHO_FORMS',
  'jumpstart-institute-id',
  'new-center-uuid',
  '{"parent name": "parentName", "phone": "phone", "children name": "childrenName"}',
  true
);
```

3. **Add to Workflow Query Nodes**
Update all relevant `node_template` entries to include the new center's `audience_id` in the comma-separated list.

4. **Create Workflow Trigger (for immediate Day 0)**
```sql
INSERT INTO workflow_trigger (
  id, workflow_id, trigger_event_name, institute_id, status, event_id
) VALUES (
  'wt_new_center_trigger',
  'wf_audience_email_01',
  'AUDIENCE_LEAD_SUBMISSION',
  'jumpstart-institute-id',
  'ACTIVE',
  'new-center-uuid'
);
```

### Modifying Message Templates
1. Create/update template in WhatsApp Business Manager
2. Update the `templateName` in relevant `TRANSFORM` node's `config_json`
3. Update `headerImage`/`headerVideo` URLs if using media

### Changing Schedule Times
1. Update `cron_expr` in `workflow_schedule` table:
```sql
UPDATE workflow_schedule 
SET cron_expr = '0 30 9 * * ?'  -- 9:30 AM
WHERE id = 'schedule_id';
```

---

## Jumpstart Center Audience IDs

| Center Name | Audience ID |
|-------------|-------------|
| Bibwewadi | `7125ee0e-85f7-4475-a845-409421793df2` |
| Viman Nagar | `09f6d308-bed4-454b-8a70-e95a66c0cffd` |
| Wakad | `cc8e2535-5e5a-49a2-82f3-312afc4ed6c7` |
| Hinjewadi | `8bcb8aaa-5477-488a-98a8-1cc4d2a331a9` |
| Karve Road | `84454ecf-d40b-4216-b4aa-01feb2c1df3f` |
| Referral Invite | `938f447a-d0a7-4219-b101-863b25272654` |
| Baner | `58f17610-ec22-42f7-8782-1cf02af8f45c` |
| Pashan | `264fb655-6058-4a62-9821-69bb984bd3f2` |
| Nayati | `48995e06-476f-42e0-8dad-3b27b2d996dc` |
| Kalyani Nagar | `3e03a4b5-b079-4e8d-8886-0ff2b231715a` |
| Magarpatta | `6b3cb024-aa14-4226-a485-18c50e4c39b3` |
| Koramangala | `7ae98465-4faa-47b9-aa0e-3edf6b97f205` |
| Pimple Saudagar | `1333ddb7-33e0-4451-9b62-efd9fc5bf838` |

---

## Workflow List Summary

### Morning Workflows (9:00 AM)
- Day 1-11 Level 1: `little_win_day_X_level_1` (X = 1-11)
- Day 1-11 Level 2: `little_win_day_X_level_2` (X = 1-11)
- Day 1-11 Level 3: `little_win_day_X_level_3` (X = 1-11)
- Day 0-2 Setup: `day_1_workflow`, `day_2_workflow`
- Certificate: `js_certificate`

### Evening Workflows (6:00 PM)
- Day 1-11 PM: `little_win_day_X_pm` (X = 1-11)

### Special Workflows
- Catch-up: `little_win_day_5_level_1_catch_up` (8:00 PM)
- Bonus: `little_win_day_3_bonus`
- Inactivity: `2_day_inactivity_workflow`

---

## Troubleshooting

### Common Issues

1. **Lead not receiving messages**
   - Check if `audience_response` record exists
   - Verify `workflow_activate_day_at` is correctly set
   - Confirm phone number format (should include country code)

2. **Wrong level messages**
   - Verify user's response to `challenge_confirmation` message
   - Check `filter-adjacent-sequence` API response

3. **Duplicate messages**
   - Check `idempotency_generation_setting` in `workflow_trigger`
   - Verify `node_dedupe_record` entries

4. **Schedule not running**
   - Confirm `workflow_schedule.status` is `ACTIVE`
   - Check `last_run_at` and `next_run_at` timestamps
   - Verify CRON expression syntax

---

## 12. Notification Service Architecture

### Overview
The `notification_service` is the core messaging engine responsible for WhatsApp communication in the Jumpstart system. It provides provider abstraction, conversational flow management, and comprehensive logging.

### 12.1 Provider Abstraction Layer

#### Supported Providers
The system supports multiple WhatsApp Business API providers through a unified architecture:

| Provider | Channel Type | Configuration | Webhook Support |
|----------|-------------|---------------|------------------|
| **Combot** | `WHATSAPP_COMBOT` | Channel-based routing | ✅ Unified webhook |
| **WATI** | `WHATSAPP` | URL path-based routing | ✅ Unified webhook |
| **Meta** | `WHATSAPP` | Generic handler | ✅ Unified webhook |

#### Provider Selection
Provider selection is automatic based on institute configuration stored in `channel_to_institute_mapping` table.

```java
// Provider is determined by channel_type in mapping
// Example: WHATSAPP_COMBOT → Use Combot sender
//          WHATSAPP → Use WATI sender
```

---

### 12.2 Database Architecture

#### `channel_to_institute_mapping`
Maps WhatsApp Business Channel IDs to institutes and provider types.

| Column | Type | Description | Example |
|--------|------|-------------|----------|
| `channel_id` | VARCHAR(50) PK | WhatsApp Business Phone Number ID | `935184396337916` |
| `channel_type` | VARCHAR(50) | Provider channel type | `WHATSAPP_COMBOT` |
| `display_channel_number` | VARCHAR(30) | Display phone number | `919665587999` |
| `institute_id` | VARCHAR(255) | Institute UUID | `757d50c5-...` |
| `is_active` | BOOLEAN | Active status | `true` |
| `created_at` | TIMESTAMP | Creation timestamp | |
| `updated_at` | TIMESTAMP | Last update timestamp | |

**Jumpstart Configuration:**
```sql
channelId: 935184396337916
channel_type: WHATSAPP_COMBOT
display_number: 919665587999
institute_id: 757d50c5-4e0a-4758-9fc6-ee62479df549
```

---

#### `notification_log`
Comprehensive log of all WhatsApp messages (incoming and outgoing) and delivery status events.

| Column | Type | Description | Example |
|--------|------|-------------|----------|
| `id` | VARCHAR(255) PK | Log entry UUID | |
| `notification_type` | VARCHAR(50) | Message type/status | `WHATSAPP_OUTGOING`, `WHATSAPP_INCOMING`, `WHATSAPP_SENT`, `WHATSAPP_DELIVERED`, `WHATSAPP_READ` |
| `channel_id` | VARCHAR(255) | User's phone number | `919876543210` |
| `body` | TEXT | Message content | "Welcome to Day 1 challenge!" |
| `source` | VARCHAR(100) | Source system | `COMBOT`, `notification_log_id` (for status events) |
| `source_id` | VARCHAR(255) | Provider message ID | `wamid.HBgLOTE5ODY...` |
| `user_id` | VARCHAR(255) | User UUID (if available) | |
| `sender_business_channel_id` | VARCHAR(50) | Business channel ID | `935184396337916` |
| `message_payload` | TEXT | Full webhook payload (JSON) | Provider-specific structure |
| `notification_date` | TIMESTAMP | Event timestamp | |
| `created_at` | TIMESTAMP | Record creation time | |
| `updated_at` | TIMESTAMP | Last update time | |

**Message Flow Tracking:**
```
OUTGOING → SENT → DELIVERED → READ
         ↓
       FAILED (if delivery fails)
       
INCOMING → User response received
```

**Use Cases:**
- Conversation history tracking
- Delivery status monitoring  
- Analytics and engagement metrics
- Debugging message flows
- State machine context (finding last sent template)

---

#### `channel_flow_config`
Defines conversational flow rules - maps user responses to next templates.

| Column | Type | Description | Example |
|--------|------|-------------|----------|
| `id` | VARCHAR(255) PK | Flow config UUID | `flow_config_002` |
| `institute_id` | VARCHAR(255) | Institute UUID | `757d50c5-...` |
| `channel_type` | VARCHAR(255) | Provider channel type | `WHATSAPP_COMBOT` |
| `current_template_name` | TEXT | Current template identifier | `new_day_2` |
| `response_template_config` | TEXT | Response→Template mapping (JSON) | `{"YES": ["challenge_confirmation"], "INVITE FRIENDS": ["invite_temp"]}` |
| `variable_config` | TEXT | Template→Variables mapping (JSON) | `{"challenge_confirmation": ["parent name", "children name"]}` |
| `fixed_variables_config` | TEXT | Static variable values (JSON) | `{"table_mat": {"link": "https://...", "filename": "table mat.pdf"}}` |
| `action_template_config` | TEXT | Workflow execution rules (JSON) | `{"rules": [{"trigger": "VERIFY", "actions": [{"type": "WORKFLOW"}]}]}` |
| `is_active` | BOOLEAN | Active status | `true` |
| `created_at` | TIMESTAMP | Creation timestamp | |
| `updated_at` | TIMESTAMP | Last update timestamp | |

**Example: Day 2 Completion Check**
```json
{
  "id": "flow_config_002",
  "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
  "channel_type": "WHATSAPP_COMBOT",
  "current_template_name": "new_day_2",
  "response_template_config": {
    "YES": ["challenge_confirmation"],
    "INVITE FRIENDS": ["invite_temp", "invite_temp_second_message"]
  },
  "variable_config": {
    "challenge_confirmation": ["parent name", "children name"]
  }
}
```

**Conversational Flow Example:**
```
System sends: "new_day_2" template at 6PM → "Did you complete today's challenge?"
  ↓
User replies: "YES"
  ↓
System finds flow_config where current_template_name = "new_day_2"
  ↓
System checks response_template_config for "YES" → finds ["challenge_confirmation"]
  ↓
System sends "challenge_confirmation" template with variables [parent name, children name]
  ↓
User receives: "Great job, {{parent_name}}! {{children_name}} is making progress!"
```

**Workflow Execution via `action_template_config`:**
```json
{
  "rules": [
    {
      "trigger": "VERIFY",
      "match_type": "exact",
      "actions": [
        {
          "type": "WORKFLOW",
          "workflowId": "enrollment-activation-workflow-001"
        }
      ]
    }
  ],
  "package_session_id": "752995e1-177b-4fbb-8a9d-3ec7ce2f8aeb"
}
```

---

#### `notification_template_day_map`
Maps templates to specific days for analytics and response tracking.

| Column | Type | Description | Example |
|--------|------|-------------|----------|
| `id` | UUID PK | Map entry UUID | |
| `institute_id` | UUID | Institute UUID | `757d50c5-...` |
| `sender_business_channel_id` | VARCHAR(255) | Business channel ID | `935184396337916` |
| `day_number` | INT | Challenge day number | `2` |
| `day_label` | VARCHAR(255) | Human-readable day label | `day 2` |
| `template_identifier` | VARCHAR(255) | Template name to match in logs | `challenge_confirmation` |
| `sub_template_label` | VARCHAR(255) | Sub-category label | `LEVEL 2 (2-4 YEARS)`, `YES`, `COMPLETED CHALLENGE 2` |
| `is_active` | BOOLEAN | Active status | `true` |
| `created_at` | TIMESTAMP | Creation timestamp | |
| `notification_type` | VARCHAR(50) | Message flow direction | `WHATSAPP_MESSAGE_INCOMING`, `WHATSAPP_MESSAGE_OUTGOING` |
| `channel_type` | VARCHAR(50) | Channel type | `WHATSAPP` |

**Use Cases:**
- **Analytics Dashboard**: Track how many users responded "YES" on Day 2
- **Engagement Metrics**: Count completion confirmations per level
- **Response Rate Analysis**: Calculate % of users who responded to PM checks
- **User Segmentation**: Identify users by engagement patterns

**Example Queries:**
```sql
-- Count Day 2 "YES" responses
SELECT COUNT(*) 
FROM notification_log nl
JOIN notification_template_day_map ntdm 
  ON nl.body LIKE '%' || ntdm.template_identifier || '%'
WHERE ntdm.day_number = 2 
  AND ntdm.sub_template_label = 'YES'
  AND ntdm.notification_type = 'WHATSAPP_MESSAGE_INCOMING';

-- Track Level 1 challenge completions across all days
SELECT day_number, COUNT(*) as completions
FROM notification_log nl
JOIN notification_template_day_map ntdm 
  ON nl.body LIKE '%' || ntdm.template_identifier || '%'
WHERE ntdm.sub_template_label LIKE 'COMPLETED CHALLENGE%'
  AND ntdm.sub_template_label LIKE '%LEVEL 1%'
GROUP BY day_number
ORDER BY day_number;
```

---

### 12.3 Webhook Architecture

#### Unified Webhook Endpoints

| Provider | Endpoint | Method | Notes |
|----------|----------|--------|-------|
| **Combot** | `/notification-service/v1/webhook/whatsapp` | POST | Supports both Combot simple format and WhatsApp Cloud API format |
| **WATI** | `/notification-service/webhook/v1/wati/{channelId}` | POST | Channel ID in URL path (WATI doesn't include it in payload) |
| **Meta** | `/notification-service/webhook/v1/meta/{channelId}` | POST | Generic Meta WhatsApp Cloud API handler |

#### Webhook Processing Flow

```
┌─────────────────────────┐
│  Provider Webhook Call  │
│  (Combot/WATI/Meta)     │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  VendorWebhookHandler   │
│  - Parse payload        │
│  - Extract event type   │
│  - Normalize to unified │
│    event structure      │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Event Type Detection   │
└──────────┬──────────────┘
           │
     ┌─────┴─────┬───────────────┐
     │           │               │
     ▼           ▼               ▼
┌─────────┐ ┌──────────┐ ┌──────────────┐
│ STATUS  │ │ INCOMING │ │   OUTGOING   │
│ UPDATE  │ │ MESSAGE  │ │   MESSAGE    │
└────┬────┘ └─────┬────┘ └──────┬───────┘
     │            │              │
     ▼            ▼              ▼
┌─────────────────────────────────────┐
│   CombotWebhookService              │
│                                     │
│   processMessageStatusFromWebhook() │
│   ├─ Find original outgoing log     │
│   ├─ Create status log entry        │
│   └─ Link to original message       │
│                                     │
│   processIncomingMessageFromWebhook()│
│   ├─ Log incoming message           │
│   ├─ Find last sent template        │
│   ├─ Lookup flow config             │
│   ├─ Match user response to rule    │
│   ├─ Execute workflow (if configured)│
│   └─ Send next template(s)          │
│                                     │
│   logOutgoingMessage()              │
│   └─ Create outgoing log entry      │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│  notification_log       │
│  (Database)             │
└─────────────────────────┘
```

#### Webhook Event Types

1. **STATUS Events**: Delivery status updates
   - `WHATSAPP_SENT` - Message accepted by WhatsApp
   - `WHATSAPP_DELIVERED` - Message delivered to recipient device
   - `WHATSAPP_READ` - Message read by recipient
   - `WHATSAPP_FAILED` - Message delivery failed

2. **INCOMING Events**: User sends message
   - Extract message text
   - Log as `WHATSAPP_INCOMING`
   - Trigger conversational flow

3. **OUTGOING Events**: System sends message
   - Log as `WHATSAPP_OUTGOING`
   - Store template name and variables

---

### 12.4 Conversational Flow Engine

#### State Machine Logic

```java
// Pseudocode for incoming message processing

1. User sends "YES" on WhatsApp
   ↓
2. Webhook receives message
   ↓
3. Log to notification_log (type: WHATSAPP_INCOMING)
   ↓
4. Find last outgoing message to this user:
   SELECT * FROM notification_log 
   WHERE channel_id = 'user_phone'
     AND notification_type = 'WHATSAPP_OUTGOING'
   ORDER BY notification_date DESC
   LIMIT 1
   ↓
5. Extract template name from last message payload
   (e.g., "new_day_2")
   ↓
6. Look up flow config:
   SELECT * FROM channel_flow_config
   WHERE current_template_name = 'new_day_2'
     AND institute_id = 'xxx'
   ↓
7. Parse response_template_config JSON:
   {
     "YES": ["challenge_confirmation"],
     "NO": ["encouragement_message"]
   }
   ↓
8. Match user input "YES" → Get ["challenge_confirmation"]
   ↓
9. Check for action_template_config:
   - If workflow trigger matches, execute workflow
   ↓
10. Fetch variable values:
    - Query user details (parent_name, children_name)
    - Check fixed_variables_config for static values
    ↓
11. Send template "challenge_confirmation" with variables
    ↓
12. Log outgoing message to notification_log
```

#### Flow Configuration Examples

**Example 1: Simple Response Flow**
```json
{
  "current_template_name": "day_1_js",
  "response_template_config": {
    "INVITE FRIENDS": ["invite_temp", "invite_temp_second_message"]
  },
  "variable_config": {}
}
```
User says "INVITE FRIENDS" → System sends 2 templates sequentially

**Example 2: Multi-Level Response**
```json
{
  "current_template_name": "challenge_confirmation",
  "response_template_config": {
    "LEVEL 1 (<2 YEARS)": ["greeting"],
    "LEVEL 2 (2-4 YEARS)": ["greeting"],
    "LEVEL 3 (>4 YEARS)": ["greeting"]
  }
}
```
User selects level → System sends appropriate greeting template

**Example 3: File Attachment with Fixed Variables**
```json
{
  "current_template_name": "little_win_day_7_level_1",
  "response_template_config": {
    "GET MY TABLE MAT": ["table_mat"]
  },
  "variable_config": {
    "table_mat": ["link", "filename"]
  },
  "fixed_variables_config": {
    "table_mat": {
      "link": "https://confidentialcontent.s3.eu-west-1.wasabisys.com/media/730e6318-780c-47bf-b8c4-043e10442431",
      "filename": "table mat.pdf"
    }
  }
}
```
User says "GET MY TABLE MAT" → System sends file with static URL

**Example 4: Workflow Execution**
```json
{
  "current_template_name": "default",
  "response_template_config": {},
  "action_template_config": {
    "rules": [
      {
        "trigger": "VERIFY",
        "match_type": "exact",
        "actions": [
          {
            "type": "WORKFLOW",
            "workflowId": "enrollment-activation-workflow-001"
          }
        ]
      }
    ],
    "package_session_id": "752995e1-177b-4fbb-8a9d-3ec7ce2f8aeb"
  }
}
```
User says "VERIFY" → System triggers workflow in admin-core-service

---

### 12.5 Workflow Execution Integration

The notification service can trigger workflows in `admin-core-service` based on user responses.

#### Architecture

```
┌──────────────────────────────────────────────┐
│  User sends "VERIFY" via WhatsApp            │
└────────────────┬─────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────┐
│  Notification Service Webhook                │
│  ├─ Logs incoming message                    │
│  ├─ Finds flow config with action rules      │
│  └─ Matches trigger "VERIFY"                 │
└────────────────┬─────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────┐
│  FlowActionRouter                            │
│  └─ Dispatches to WorkflowActionExecutor     │
└────────────────┬─────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────┐
│  WorkflowActionExecutor                      │
│  POST /admin-core-service/internal/workflow/run │
│  Body: {                                     │
│    "phone_number": "919876543210",          │
│    "instituteId": "757d50c5-...",           │
│    "package_session_id": "752995e1-...",    │
│    "messageText": "VERIFY"                  │
│  }                                           │
└────────────────┬─────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────┐
│  Admin Core Service - Workflow Engine        │
│  (Executes workflow nodes)                   │
└──────────────────────────────────────────────┘
```

#### Action Types

| Action Type | Description | Executor |
|-------------|-------------|----------|
| `WORKFLOW` | Triggers workflow execution | `WorkflowActionExecutor` |
| `VERIFICATION` | User verification actions | `VerificationActionExecutor` |

---

### 12.6 Integration with Jumpstart Workflows

#### Message Sending Flow

```
┌─────────────────────────────────────────────────┐
│  Admin Core Service - Workflow Scheduler        │
│  (CRON triggers at 9AM/6PM)                     │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  Workflow Execution (Day 2 AM Example)          │
│  Nodes:                                         │
│  1. HTTP_REQUEST (filter users by day)          │
│  2. QUERY (get leads)                           │
│  3. TRANSFORM (build message payload)           │
│  4. SEND_WHATSAPP                               │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  Notification Service API                       │
│  POST /notification-service/v1/combot/send      │
│  Body: {                                        │
│    "channelId": "935184396337916",            │
│    "phoneNumber": "919876543210",             │
│    "templateName": "new_day_2",               │
│    "variables": ["Priya", "Aarav"]            │
│  }                                              │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  Provider API (Combot/WATI)                     │
│  - Sends WhatsApp message                       │
│  - Returns message ID                           │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  CombotWebhookService.logOutgoingMessage()      │
│  - Creates notification_log entry               │
│  - Type: WHATSAPP_OUTGOING                      │
│  - Stores template name in payload              │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  User receives WhatsApp message                 │
└─────────────────────────────────────────────────┘
```

#### Response Handling Flow

```
┌─────────────────────────────────────────────────┐
│  User replies "YES" on WhatsApp at 6:15 PM      │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  Provider Webhook → Notification Service        │
│  POST /notification-service/v1/webhook/whatsapp │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  CombotWebhookService                           │
│  .processIncomingMessageFromWebhook()           │
│                                                 │
│  1. Log incoming message                        │
│  2. Find last template sent ("new_day_2")       │
│  3. Lookup flow config for "new_day_2"          │
│  4. Match "YES" → ["challenge_confirmation"]    │
│  5. Fetch user details (parent/child names)     │
│  6. Send "challenge_confirmation" template      │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  User receives confirmation message             │
│  "Great job, Priya! Aarav completed Day 2!"     │
└─────────────────────────────────────────────────┘
```

---

### 12.7 Analytics Integration

The `notification_template_day_map` table enables analytics by mapping template identifiers to days and categories.

**Sample Analytics Queries:**

```sql
-- 1. Daily completion rate
SELECT 
    ntdm.day_number,
    ntdm.day_label,
    COUNT(DISTINCT nl.channel_id) as unique_responders
FROM notification_template_day_map ntdm
LEFT JOIN notification_log nl 
    ON nl.body LIKE '%' || ntdm.template_identifier || '%'
    AND nl.notification_type = 'WHATSAPP_MESSAGE_INCOMING'
WHERE ntdm.sub_template_label LIKE 'COMPLETED CHALLENGE%'
    AND ntdm.institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
GROUP BY ntdm.day_number, ntdm.day_label
ORDER BY ntdm.day_number;

-- 2. Level-wise engagement
SELECT 
    CASE 
        WHEN ntdm.sub_template_label LIKE '%LEVEL 1%' THEN 'Level 1 (<2 years)'
        WHEN ntdm.sub_template_label LIKE '%LEVEL 2%' THEN 'Level 2 (2-4 years)'
        WHEN ntdm.sub_template_label LIKE '%LEVEL 3%' THEN 'Level 3 (>4 years)'
    END as user_level,
    COUNT(*) as message_count
FROM notification_template_day_map ntdm
JOIN notification_log nl 
    ON nl.body LIKE '%' || ntdm.template_identifier || '%'
WHERE ntdm.notification_type = 'WHATSAPP_MESSAGE_OUTGOING'
    AND ntdm.sub_template_label LIKE '%LEVEL%'
GROUP BY user_level;

-- 3. Invite friends engagement
SELECT 
    ntdm.day_number,
    COUNT(DISTINCT nl.channel_id) as users_clicked_invite
FROM notification_template_day_map ntdm
JOIN notification_log nl 
    ON nl.body LIKE '%' || ntdm.template_identifier || '%'
WHERE ntdm.sub_template_label = 'INVITE FRIENDS'
    AND ntdm.notification_type = 'WHATSAPP_MESSAGE_INCOMING'
GROUP BY ntdm.day_number
ORDER BY ntdm.day_number;
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2025 | Initial Jumpstart workflow implementation |
| 1.1 | Dec 2025 | Added Level 2 and Level 3 support |
| 1.2 | Dec 2025 | Added PM (evening) workflows |
| 1.3 | Dec 2025 | Added catch-up and certificate workflows |
| 1.4 | Jan 2026 | Generic WhatsApp provider support (Combot + WATI) |
| 1.5 | Feb 2026 | Added comprehensive notification service architecture documentation |

---

*Documentation generated for Jumpstart 14-Day Challenge Project*
*Last Updated: February 2026*
