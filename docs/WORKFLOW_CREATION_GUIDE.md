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

Add 3 nodes from the left palette and connect them:

```
[QUERY] ──> [LOOP (For Each)] ──> [SEND_EMAIL]
```

### Step 5 — Configure QUERY Node

Click the QUERY node on the canvas.

| Field | What to do |
|-------|-----------|
| Query | Select **"Fetch Audience Responses (Filtered)"** |
| instituteId | Shows green "Auto-filled from workflow context" — no action needed |
| audienceId | Type your audience/campaign ID (find it in Audience Manager). Leave empty for ALL audiences |
| daysAgo | Type `5` |
| Result Key | Type `leadData` |

### Step 6 — Configure LOOP Node

Click the LOOP node.

| Field | What to do |
|-------|-----------|
| Source List | Click the `</>` code icon to switch to Advanced mode. Type: `#ctx['leadData']['leads']` |
| Item Variable | Type `lead` |

### Step 7 — Configure SEND_EMAIL Node

Click the SEND_EMAIL node.

| Field | What to do |
|-------|-----------|
| Email Template | Select your follow-up template from the dropdown |
| Recipients | Click `</>` code icon for Advanced mode. Type: `#ctx['lead']['email']` |

If your template has dynamic parameters (e.g., `{{name}}`), they'll appear as fields below. For each:
- Click `</>` to switch to Advanced mode
- Type the SpEL expression, e.g., `#ctx['lead']['parentName']`

> **Note:** The field names like `email`, `parentName` come from the custom fields defined on your audience form. Check your audience form's custom fields to know the exact field names.

### Step 8 — Publish

Click **Publish** in the top toolbar.

### How It Works

Every day at 9:00 AM IST:
1. The QUERY finds all audience form submissions from exactly 5 days ago
2. The LOOP iterates through each lead
3. SEND_EMAIL sends the follow-up email to each lead

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
[QUERY] ──> [LOOP (For Each)] ──> [SEND_EMAIL]
```

### Step 5 — Configure QUERY Node

| Field | What to do |
|-------|-----------|
| Query | Select **"Batch Attendance Report (All Students)"** |
| instituteId | Auto-filled |
| batchId | Leave empty for ALL batches, or type a specific batch ID |
| daysBack | Type `7` |
| Result Key | Type `reportData` |

### Step 6 — Configure LOOP Node

| Field | What to do |
|-------|-----------|
| Source List | Advanced mode: `#ctx['reportData']['students']` |
| Item Variable | `student` |

### Step 7 — Configure SEND_EMAIL Node

| Field | What to do |
|-------|-----------|
| Email Template | Select `weekly_attendance_report` |
| Recipients | Advanced mode: `#ctx['student']['email']` |
| Template Variables (map each): | |
| `studentName` | `#ctx['student']['fullName']` |
| `attendancePercentage` | `#ctx['student']['attendancePercentage']` |
| `totalDurationMinutes` | `#ctx['student']['totalDurationMinutes']` |
| `totalChats` | `#ctx['student']['totalChats']` |
| `totalHandRaises` | `#ctx['student']['totalHandRaises']` |
| `sessionsAttended` | `#ctx['student']['sessionsAttended']` |
| `startDate` | `#ctx['reportData']['startDate']` |
| `endDate` | `#ctx['reportData']['endDate']` |

### Step 8 — Publish

### Email Template Setup

Before publishing, create the email template in **Settings > Templates**:

| Field | Value |
|-------|-------|
| Type | `EMAIL` |
| Name | `weekly_attendance_report` |
| Subject | `Weekly Report for {{studentName}} — {{attendancePercentage}}% Attendance` |
| Dynamic Parameters | `{"studentName":"string","attendancePercentage":"string","totalDurationMinutes":"string","totalChats":"string","totalHandRaises":"string","sessionsAttended":"string","startDate":"string","endDate":"string"}` |

HTML Content:
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2>Weekly Report for {{studentName}}</h2>
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

## Tips

1. **Always test with "Test Run"** before publishing — it does a dry run without sending real emails
2. **Check the Executions tab** on the workflow details page to see if it ran and any errors
3. **Optional params left empty = apply to all** — e.g., empty `batchId` = all batches, empty `audienceId` = all audiences
4. **`instituteId` is always auto-filled** — you never need to set it manually
5. **Use Advanced mode (`</>` icon)** when the variable picker is empty — type SpEL expressions directly
6. **Email template must exist first** — create it in Settings > Templates before creating the workflow
7. **Template field names must match** — the `dynamic_parameters` JSON keys in the template must match what you map in the SEND_EMAIL node's Template Variables section
