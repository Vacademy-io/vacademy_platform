# Workflow Creation Guide

Step-by-step instructions for creating workflows using the Vacademy workflow builder.

---

## Prerequisites

1. **Email template** must exist in Settings > Templates (type = `EMAIL`, status = `ACTIVE`)
2. **Backend deployed** with the latest workflow enhancement changes
3. Navigate to **Automations > Workflow > Create**

---

## Use Case 1: Follow-up Email 5 Days After Audience Form Fill

**Goal:** Every day at 9 AM, find leads who submitted a form exactly 5 days ago and send them a follow-up email.

### Step 1 — Setup Wizard

| Field | Value |
|-------|-------|
| Workflow Name | `Follow-up Email to Leads (5 Days After Form Fill)` |
| Description | `Sends follow-up email to leads who filled the form 5 days ago` |

Click **Next**

### Step 2 — Trigger Type

Select **"On a schedule"**

Click **Next**

### Step 3 — Schedule

| Field | Value |
|-------|-------|
| Frequency | **Daily** |
| Time | **09:00** |
| Timezone | Asia/Kolkata (IST) |

Click **Continue to Builder**

### Step 4 — Build the Canvas

Add 2 nodes from the left palette and connect them:

```
[QUERY] ──> [SEND_EMAIL]
```

> **Important:** Do NOT add a LOOP node between QUERY and SEND_EMAIL. The SEND_EMAIL node has a built-in loop via its `on` field — it iterates over the list automatically. A separate LOOP node would NOT re-execute SEND_EMAIL per item.

### Step 5 — Configure QUERY Node

Click the QUERY node on the canvas.

| Field | What to do |
|-------|-----------|
| Query | Select **"Fetch Audience Responses (Filtered)"** |
| instituteId | Shows green "Auto-filled from workflow context" — no action needed |
| audienceId | Select your audience from the dropdown, or leave empty for ALL audiences |
| daysAgo | Type `5` |

> **Note:** The "Result Key" field has no effect — query results go directly into the context using their natural keys. You can leave it as default.

### Step 6 — Configure SEND_EMAIL Node

Click the SEND_EMAIL node.

| Field | What to do |
|-------|-----------|
| Send emails to | Select **"Audience leads (from query)"** from the dropdown |
| Email Template | Select your follow-up template, or leave empty to skip |
| Send to field | Leave as "Auto-detect" (uses the `email` field from each lead) |

The query returns each lead with `email` (from parentEmail), `parentName`, and all custom field values from the audience form. The SEND_EMAIL node iterates over the leads and sends one email per lead.

> **Note:** Available fields on each lead: `email`, `parentEmail`, `parentName`, `mobileNumber`, `userId`, `id`, `createdAt`, plus any custom fields from your form (e.g., `Full Name`, `Phone Number`).

### Step 7 — Publish

Click **Publish** in the top toolbar.

### How It Works

Every day at 9:00 AM IST:
1. The QUERY finds all audience form submissions from exactly 5 days ago
2. SEND_EMAIL iterates through each lead and sends the email

Each lead gets exactly one email because `daysAgo=5` only matches submissions from the 24-hour window of exactly 5 days back.

---

## Use Case 2: Weekly Attendance & Concentration Report

**Goal:** Every Monday at 9 AM, send parents and students a weekly report with attendance % and engagement metrics.

### Step 1 — Setup Wizard

| Field | Value |
|-------|-------|
| Workflow Name | `Weekly Attendance & Engagement Report` |
| Description | `Sends weekly attendance and concentration report to students` |

Click **Next**

### Step 2 — Trigger Type

Select **"On a schedule"**

Click **Next**

### Step 3 — Schedule

| Field | Value |
|-------|-------|
| Frequency | **Weekly** |
| Days | Click **Mon** (or any day you prefer) |
| Time | **09:00** |
| Timezone | Asia/Kolkata (IST) |

Click **Continue to Builder**

### Step 4 — Build the Canvas

```
[QUERY] ──> [SEND_EMAIL]
```

> **Important:** No LOOP node needed. SEND_EMAIL iterates over the student list automatically via its built-in `on` + `forEach` mechanism.

### Step 5 — Configure QUERY Node

| Field | What to do |
|-------|-----------|
| Query | Select **"Batch Attendance Report (All Students)"** |
| instituteId | Auto-filled |
| batchId | Select a batch from the dropdown, or leave empty for ALL batches |
| daysBack | Type `7` |

> **Note:** The "Result Key" field has no effect. Query results go into context using their natural keys (`students`, `totalStudents`, `startDate`, `endDate`).

### Step 6 — Configure SEND_EMAIL Node

| Field | What to do |
|-------|-----------|
| Send emails to | Select **"Students (from attendance query)"** from the dropdown |
| Email Template | Select `weekly_attendance_report` |
| Send to field | Select **"Student Email"** to send to students, or **"Father/Parent Email"** to send to parents |

Each student item has these fields available as template placeholders:
- `fullName`, `email`, `mobileNumber`, `enrollmentNumber`
- `attendancePercentage`, `sessionsAttended`
- `totalDurationMinutes`, `totalChats`, `totalHandRaises`
- `startDate`, `endDate`
- `parentsEmail`, `guardianEmail`, `motherEmail`

### Step 7 — Publish

### Email Template Setup

Before publishing, create the email template in **Settings > Templates**:

| Field | Value |
|-------|-------|
| Type | `EMAIL` or `email` |
| Name | `weekly_attendance_report` |
| Subject | `Weekly Report for {{fullName}} — {{attendancePercentage}}% Attendance` |
| Dynamic Parameters | `{"fullName":"string","attendancePercentage":"string","totalDurationMinutes":"string","totalChats":"string","totalHandRaises":"string","sessionsAttended":"string","startDate":"string","endDate":"string"}` |

HTML Content:
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2>Weekly Report for {{fullName}}</h2>
    <p>Period: {{startDate}} to {{endDate}}</p>

    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <tr style="background:#f0f4ff;">
            <th colspan="2" style="padding:12px; text-align:left; border:1px solid #ddd;">Attendance</th>
        </tr>
        <tr>
            <td style="padding:10px; border:1px solid #eee;">Attendance</td>
            <td style="padding:10px; border:1px solid #eee;"><strong>{{attendancePercentage}}%</strong></td>
        </tr>
        <tr>
            <td style="padding:10px; border:1px solid #eee;">Sessions Attended</td>
            <td style="padding:10px; border:1px solid #eee;">{{sessionsAttended}}</td>
        </tr>
    </table>

    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <tr style="background:#fff7ed;">
            <th colspan="2" style="padding:12px; text-align:left; border:1px solid #ddd;">Engagement</th>
        </tr>
        <tr>
            <td style="padding:10px; border:1px solid #eee;">Time in Sessions</td>
            <td style="padding:10px; border:1px solid #eee;"><strong>{{totalDurationMinutes}} min</strong></td>
        </tr>
        <tr>
            <td style="padding:10px; border:1px solid #eee;">Chat Messages</td>
            <td style="padding:10px; border:1px solid #eee;">{{totalChats}}</td>
        </tr>
        <tr>
            <td style="padding:10px; border:1px solid #eee;">Hand Raises</td>
            <td style="padding:10px; border:1px solid #eee;">{{totalHandRaises}}</td>
        </tr>
    </table>

    <p style="color:#999; font-size:11px;">Automated weekly report</p>
</div>
```

---

## Use Case 3: Send Email When a Live Session is Created

**Goal:** When an admin creates a new live session, automatically send a notification email to relevant people.

### Step 1 — Setup Wizard

| Field | Value |
|-------|-------|
| Workflow Name | `Notify on Live Session Created` |

Click **Next**

### Step 2 — Trigger Type

Select **"When something happens"**

Click **Next**

### Step 3 — Choose Event

| Field | Value |
|-------|-------|
| Event | Select **"Live Session Created"** (under Live Session category) |
| Scope | Select a specific live session from dropdown, or leave as "All" |
| Description | `Send notification when new live session is created` |

Click **Continue to Builder**

### Step 4 — Build Canvas

The TRIGGER node is auto-created. Add:

```
[TRIGGER: Live Session Created] ──> [SEND_EMAIL]
```

### Step 5 — Configure SEND_EMAIL

| Field | What to do |
|-------|-----------|
| Template | Select your notification template |
| Recipients | Advanced mode: `#ctx['liveSession']['createdByUserId']` (or a list of admin emails) |
| Template Vars | Map from `#ctx['liveSession']` — e.g., title, subject, etc. |

---

## Use Case 4: Send Email on Enrollment Invite Form Fill

**Goal:** When a learner fills an enrollment invite form, send a confirmation email.

### Step 1 — Setup

| Field | Value |
|-------|-------|
| Workflow Name | `Enrollment Invite Confirmation` |
| Type | **When something happens** |
| Event | **Invite Form Filled** |
| Scope | Select specific invite or "All" |

### Step 4 — Canvas

```
[TRIGGER: Invite Form Filled] ──> [SEND_EMAIL]
```

### Step 5 — SEND_EMAIL Config

| Field | Value |
|-------|-------|
| Template | Select confirmation template |
| Recipients | Advanced mode: context depends on what's available — check `#ctx['invite']` and `#ctx['user']` |

---

## Use Case 5: Instant Email When Any Audience Form is Submitted

**Goal:** As soon as anyone submits any audience/lead form, send them a thank-you email immediately. No schedule, no delay — fires instantly on form submission.

### Step 1 — Setup Wizard

| Field | Value |
|-------|-------|
| Workflow Name | `Instant Thank You Email on Form Submit` |
| Description | `Sends immediate email when a lead submits any audience form` |

Click **Next**

### Step 2 — Trigger Type

Select **"When something happens"**

Click **Next**

### Step 3 — Choose Event

| Field | Value |
|-------|-------|
| Event | Select **"Audience Lead Submission"** (under CRM category) |
| Scope | Leave as **"All Audience / Campaigns (no restriction)"** — fires for ANY audience form |
| Description | `Instant thank you on any form submission` |

Click **Continue to Builder**

### Step 4 — Build Canvas

The TRIGGER node is auto-created. Just add one SEND_EMAIL node and connect them:

```
[TRIGGER: Audience Lead Submission] ──> [SEND_EMAIL]
```

> **Why no LOOP node?** Unlike Use Case 1 (where you query many leads and loop through them), here the trigger fires **once per form submission** with that single lead's data. The SEND_EMAIL node's `on` field points to `respondentEmailRequests` which is a list, and the node internally iterates over it via its built-in `forEach` config — no separate LOOP node needed.

### Step 5 — Configure SEND_EMAIL Node

Click the SEND_EMAIL node.

**Option A — Use the pre-built email from AudienceService (simplest):**

The trigger context includes `respondentEmailRequests` which already has `to`, `subject`, `body` pre-built by AudienceService. No template needed.

| Field | What to do |
|-------|-----------|
| Email Template | Leave as "Select template..." (don't select any) |
| Recipients | Click `</>` for Advanced mode. Type: `#ctx['respondentEmailRequests']` |

The email subject and body are auto-generated based on the audience form's configuration.

**Option B — Use a custom email template:**

If you want a custom-designed email instead of the default one:

| Field | What to do |
|-------|-----------|
| Email Template | Select your template (e.g., `lead_thank_you`) |
| Recipients | Click `</>` for Advanced mode. Type: `#ctx['respondentEmailRequests']` |

For template variables, each item in `respondentEmailRequests` has a `to` field. The template variables need to come from the trigger context:

| Template Variable | SpEL Expression | What it pulls |
|------------------|----------------|---------------|
| `name` | `#ctx['customFields']['Full Name']` | Lead's name from form |

> **Note:** The custom field names (`Full Name`, `Email`, etc.) depend on what you configured on your audience form. Check your form's custom field names to use the correct keys.

### Step 6 — Publish

Click **Publish**.

### How It Works

1. Someone fills any audience form on your institute's landing page
2. `AudienceService` saves the response and calls `workflowTriggerService.handleTriggerEvents("AUDIENCE_LEAD_SUBMISSION", audienceId, instituteId, contextData)`
3. Since your trigger has no specific audienceId (scope = all), it matches via the **global trigger fallback**
4. The workflow fires immediately — TRIGGER node passes context → SEND_EMAIL sends the email
5. Idempotency prevents duplicate emails if the same form is submitted multiple times

### Context Data Available

The `AUDIENCE_LEAD_SUBMISSION` trigger provides these context variables:

| Variable | Type | Description |
|----------|------|-------------|
| `#ctx['respondentEmailRequests']` | List | Email request objects for the respondent |
| `#ctx['adminEmailRequests']` | List | Email request objects for admins |
| `#ctx['audienceId']` | String | The audience/campaign ID |
| `#ctx['instituteId']` | String | Institute ID |
| `#ctx['customFields']` | Map | All custom field values from the form (keyed by field name) |
| `#ctx['submissionTime']` | String | When the form was submitted |
| `#ctx['responseId']` | String | The audience response record ID |

### Email Template Setup

Create this template in **Settings > Templates** before publishing the workflow:

| Field | Value |
|-------|-------|
| Type | `EMAIL` |
| Name | `lead_thank_you` |
| Subject | `Thank you for your interest, {{name}}!` |
| Dynamic Parameters | `{"name": "string", "email": "string"}` |
| Content | See HTML below |

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2>Thank you, {{name}}!</h2>
    <p>We received your inquiry and will get back to you shortly.</p>
    <p>If you have any questions, reply to this email.</p>
    <p style="color: #999; font-size: 11px; margin-top: 24px;">This is an automated message.</p>
</div>
```

---

---

## Use Case 6: HTTP Request to Fetch User Email, Then Send Email

**Goal:** Call an external/internal API to get user details (including email), then send an email using that data.

### How Data Flows Between Nodes

Before building this workflow, understand how each node stores its output:

| Node Type | How output goes into context | How to access it |
|-----------|------------------------------|-----------------|
| **QUERY** | Flattens all keys: `ctx.putAll(queryResult)` | `#ctx['leads']`, `#ctx['students']` — direct top-level keys |
| **HTTP_REQUEST** | Wraps under `resultKey`: `ctx.put(resultKey, response)` | `#ctx['httpResult']` (default) or `#ctx['myKey']` if you set resultKey |
| **TRIGGER** | Context provided by the event | `#ctx['user']`, `#ctx['customFields']`, etc. |

**Key difference:** QUERY flattens its output. HTTP_REQUEST wraps it under a key you choose.

### Step 1 — Setup

| Field | Value |
|-------|-------|
| Workflow Name | `Fetch User & Send Email` |
| Type | **On a schedule** or **When something happens** (your choice) |

### Step 2 — Build Canvas

```
[HTTP_REQUEST] ──> [SEND_EMAIL]
```

### Step 3 — Configure HTTP_REQUEST Node

Click the HTTP_REQUEST node.

| Field | Value |
|-------|-------|
| Request Type | `INTERNAL` (for calling your own backend) or `EXTERNAL` (for third-party APIs) |
| URL | e.g., `/admin-core-service/v1/some-endpoint?userId=123` |
| Method | `GET` |

The HTTP_REQUEST node stores its response under `ctx['httpResult']` by default. The response structure is:

```json
{
  "httpResult": {
    "statusCode": 200,
    "body": {
      "email": "user@example.com",
      "fullName": "John Doe",
      "mobileNumber": "9876543210"
    },
    "headers": { ... }
  }
}
```

### Step 4 — Configure SEND_EMAIL Node

The HTTP response is at `ctx['httpResult']`. The response body (with user data) is at `ctx['httpResult']['body']`.

Since the HTTP response is a single object (not a list), wrap it in a list for SEND_EMAIL:

| Field | Value |
|-------|-------|
| Send emails to | Switch to Advanced mode (`</>`). Type: `{#ctx['httpResult']['body']}` |
| Email Template | Select your template |
| Send to field | Auto-detect (finds `email` from the response body) |

If the API returns a **list** of users directly:

| Field | Value |
|-------|-------|
| Send emails to | Advanced mode: `#ctx['httpResult']['body']` |

### Template Variables

The response body fields are available as placeholders. If the API returns:
```json
{ "email": "user@example.com", "fullName": "John Doe" }
```

Your template can use `{{email}}`, `{{fullName}}` directly — the handler auto-adds all item fields as placeholders.

If you need to map different names, use template variables:
- `name` → `fullName` (looks up `fullName` from the item)

---

## How to Access Data From Any Upstream Node

### Quick Reference

| Upstream Node | Its output goes to | Access in downstream node |
|---------------|-------------------|--------------------------|
| **QUERY** (`fetch_audience_responses_filtered`) | `ctx['leads']` (top-level) | `#ctx['leads']` |
| **QUERY** (`fetch_batch_attendance_report`) | `ctx['students']` (top-level) | `#ctx['students']` |
| **QUERY** (`fetch_ssigm_by_package`) | `ctx['ssigm']` (top-level) | `#ctx['ssigm']` |
| **HTTP_REQUEST** (default resultKey) | `ctx['httpResult']` (wrapped) | `#ctx['httpResult']['body']` for response data |
| **HTTP_REQUEST** (custom resultKey=`userData`) | `ctx['userData']` (wrapped) | `#ctx['userData']['body']` |
| **TRIGGER** (AUDIENCE_LEAD_SUBMISSION) | Various context keys | `#ctx['respondentEmailRequests']`, `#ctx['user']`, `#ctx['customFields']` |
| **TRIGGER** (LEARNER_BATCH_ENROLLMENT) | Various context keys | `#ctx['user']`, `#ctx['packageSessionIds']` |
| **FILTER** (outputKey=`filteredList`) | `ctx['filteredList']` (wrapped) | `#ctx['filteredList']` |
| **LOOP** (outputKey=`loopResults`) | `ctx['loopResults']` + `ctx['item']` | `#ctx['loopResults']` (all), `#ctx['item']` (last only) |
| **CONDITION** | `ctx['conditionResult']` | Used by routing, not directly |

### Important Rules

1. **QUERY results are flat** — keys go directly into context. If a query returns `{"leads": [...], "totalCount": 5}`, you access `#ctx['leads']` and `#ctx['totalCount']` separately.
2. **HTTP_REQUEST results are wrapped** — response goes under `resultKey`. Access the body with `#ctx['httpResult']['body']`.
3. **SEND_EMAIL's `on` field must resolve to a List** — if you have a single object, wrap it: `{#ctx['singleObject']}` creates a list with one item.
4. **LOOP does NOT re-execute downstream nodes** — it only sets context. Use SEND_EMAIL's built-in `on` + `forEach` for iterating over lists.
5. **ResultKey in QUERY node has NO effect** — it's ignored. QUERY always uses `putAll()`.

---

---

## Use Case 7: Notify Students When a Live Session is Created

**Goal:** When an admin creates a live session, automatically fetch all students from specific batches and send them a notification email about the new session.

### Why This Needs 3 Nodes (Not 2)

The `LIVE_SESSION_CREATE` trigger only provides the `liveSession` object (title, time, link, etc.) and `createdBy` (admin who created it). It does NOT have student emails. You need a QUERY node to fetch students from batches.

### Step 1 — Setup

| Field | Value |
|-------|-------|
| Workflow Name | `Notify Students on New Live Session` |
| Type | **When something happens** |
| Event | **Live Session Created** |
| Scope | Leave as "All" (fires for any new session) |

### Step 2 — Build Canvas (3 Nodes)

```
[TRIGGER: Live Session Created] → [QUERY: Batch Attendance Report] → [SEND_EMAIL]
```

### Step 3 — Configure QUERY Node

| Field | What to do |
|-------|-----------|
| Query | Select **"Get Students from Batch (Lightweight)"** |
| instituteId | Auto-filled |
| batchId | Select the specific batch from dropdown |

> **Why "Lightweight"?** This query only fetches student names, emails, and phone numbers — no attendance or engagement data. It's fast and designed for sending notifications. Use "Batch Attendance Report" only when you need attendance % and engagement metrics in the email.

### Step 4 — Configure SEND_EMAIL Node

| Field | What to do |
|-------|-----------|
| Send emails to | Select **"Students (from attendance query)"** |
| Email Template | Select your session notification template |
| Send to field | **Student Email** |

### Template Variables

Your email template can use these fields from each student item:

| Template placeholder | Field name to map | Example value |
|---------------------|------------------|---------------|
| `{{fullName}}` | `fullName` | John Doe |
| `{{email}}` | `email` | john@example.com |

For live session details, the template vars need SpEL expressions since session data is in the context, not on each student:

| Template placeholder | Value to type |
|---------------------|---------------|
| `{{sessionTitle}}` | `#ctx['liveSession'].title` |
| `{{sessionTime}}` | `#ctx['liveSession'].startTime` |
| `{{meetLink}}` | `#ctx['liveSession'].defaultMeetLink` |

### Email Template

Create in Settings > Templates:

| Field | Value |
|-------|-------|
| Type | `EMAIL` |
| Name | `live_session_notification` |
| Subject | `New Live Session: {{sessionTitle}}` |
| Dynamic Parameters | `{"fullName":"string","sessionTitle":"string","sessionTime":"string","meetLink":"string"}` |

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2>New Live Session Scheduled</h2>
    <p>Hi {{fullName}},</p>
    <p>A new live session has been scheduled:</p>
    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <tr>
            <td style="padding:10px; border:1px solid #eee; font-weight:bold;">Session</td>
            <td style="padding:10px; border:1px solid #eee;">{{sessionTitle}}</td>
        </tr>
        <tr>
            <td style="padding:10px; border:1px solid #eee; font-weight:bold;">Time</td>
            <td style="padding:10px; border:1px solid #eee;">{{sessionTime}}</td>
        </tr>
        <tr>
            <td style="padding:10px; border:1px solid #eee; font-weight:bold;">Link</td>
            <td style="padding:10px; border:1px solid #eee;"><a href="{{meetLink}}">Join Session</a></td>
        </tr>
    </table>
</div>
```

### Context Data Available from LIVE_SESSION_CREATE Trigger

| Context key | Type | What it contains |
|-------------|------|-----------------|
| `#ctx['liveSession']` | LiveSession object | title, subject, startTime, lastEntryTime, defaultMeetLink, status, accessLevel, timezone |
| `#ctx['createdBy']` | String | User ID of admin who created the session |
| `#ctx['instituteId']` | String | Institute ID |

**Important:** The trigger does NOT provide `respondentEmailRequests`, `user`, `customFields`, or any student data. Those are only available for `AUDIENCE_LEAD_SUBMISSION` triggers. Each trigger type has its own context.

---

## Tips

1. **Always test with "Test Run"** before publishing — it does a dry run without sending real emails
2. **Check the Executions tab** on the workflow details page to see if it ran and any errors
3. **Optional params left empty = apply to all** — e.g., empty `batchId` = all batches, empty `audienceId` = all audiences
4. **`instituteId` is always auto-filled** — you never need to set it manually
5. **Use Advanced mode (`</>` icon)** when the variable picker is empty — type SpEL expressions directly
6. **Email template must exist first** — create it in Settings > Templates before creating the workflow
7. **Template field names must match** — the `dynamic_parameters` JSON keys in the template must match what you map in the SEND_EMAIL node's Template Variables section
