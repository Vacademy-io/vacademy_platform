/**
 * Pre-built sample email templates for the six lead trigger events.
 * Mirrors `SAMPLE_TEMPLATES` in routes/workflow/create/-components/sample-email-templates.ts:
 * when the user clicks "Create sample template" in the Trigger Workflow dialog we create one
 * of these in their template library and select it — no form needed.
 *
 * Templates are addressed to the counsellor (the default recipient) but use lead-info
 * placeholders so they read sensibly even when the recipient is the parent. All variables
 * come from the ctx that LeadTriggerContextBuilder + LeadSlaScheduler emit.
 */

export interface SampleLeadTemplate {
    name: string;
    subject: string;
    /** Plain HTML; rendered as the email body. */
    html: string;
    variables: string[];
}

export const SAMPLE_LEAD_TEMPLATES: Record<string, SampleLeadTemplate> = {
    LEAD_ASSIGNED_TO_COUNSELOR: {
        name: 'Lead Assigned — Counsellor Notice',
        subject: 'New lead assigned: {{parentName}}',
        variables: [
            'counselorName',
            'parentName',
            'parentMobile',
            'parentEmail',
            'campaignName',
        ],
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1a1a1a">Hi {{counselorName}},</h2>
  <p style="color:#444;line-height:1.6">A new lead has been assigned to you.</p>
  <ul style="color:#444;line-height:1.8">
    <li><strong>Name:</strong> {{parentName}}</li>
    <li><strong>Mobile:</strong> {{parentMobile}}</li>
    <li><strong>Email:</strong> {{parentEmail}}</li>
    <li><strong>Campaign:</strong> {{campaignName}}</li>
  </ul>
  <p style="color:#444;line-height:1.6">Please reach out at the earliest.</p>
</div>`,
    },

    LEAD_TAT_REMINDER_BEFORE: {
        name: 'Lead TAT — Reminder',
        subject: 'Reminder: respond to {{parentName}} within {{minutesToBreach}} minutes',
        variables: [
            'counselorName',
            'parentName',
            'parentMobile',
            'campaignName',
            'minutesToBreach',
            'dueAt',
        ],
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#b45309">Lead awaiting your response</h2>
  <p style="color:#444;line-height:1.6">Hi {{counselorName}},</p>
  <p style="color:#444;line-height:1.6">This lead needs a response in
    <strong>{{minutesToBreach}} minutes</strong>:</p>
  <ul style="color:#444;line-height:1.8">
    <li><strong>{{parentName}}</strong> — {{parentMobile}}</li>
    <li>Campaign: {{campaignName}}</li>
    <li>SLA due at: {{dueAt}}</li>
  </ul>
</div>`,
    },

    LEAD_TAT_OVERDUE: {
        name: 'Lead TAT — Overdue',
        subject: 'Overdue: {{parentName}} has not been contacted',
        variables: [
            'counselorName',
            'parentName',
            'parentMobile',
            'campaignName',
            'dueAt',
        ],
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#b91c1c">Lead TAT overdue</h2>
  <p style="color:#444;line-height:1.6">Hi {{counselorName}}, the SLA deadline has passed for this lead:</p>
  <ul style="color:#444;line-height:1.8">
    <li><strong>{{parentName}}</strong> — {{parentMobile}}</li>
    <li>Campaign: {{campaignName}}</li>
    <li>Due at: {{dueAt}}</li>
  </ul>
  <p style="color:#444">Please act on this lead as soon as possible.</p>
</div>`,
    },

    FOLLOW_UP_DUE: {
        name: 'Follow-up — Due',
        subject: 'Follow-up due for {{parentName}}',
        variables: [
            'counselorName',
            'parentName',
            'parentMobile',
            'dueAt',
            'minutesToBreach',
        ],
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1a1a1a">Follow-up due</h2>
  <p style="color:#444;line-height:1.6">Hi {{counselorName}}, your next follow-up for
    <strong>{{parentName}}</strong> ({{parentMobile}}) is due in
    <strong>{{minutesToBreach}}</strong> minutes (at {{dueAt}}).</p>
</div>`,
    },

    FOLLOW_UP_OVERDUE: {
        name: 'Follow-up — Overdue',
        subject: 'Follow-up overdue for {{parentName}}',
        variables: ['counselorName', 'parentName', 'parentMobile', 'dueAt'],
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#b91c1c">Follow-up overdue</h2>
  <p style="color:#444;line-height:1.6">Hi {{counselorName}}, the follow-up for
    <strong>{{parentName}}</strong> ({{parentMobile}}) is overdue (was due at {{dueAt}}).</p>
  <p style="color:#444">Please action this lead now.</p>
</div>`,
    },

    LEAD_STATUS_CHANGED: {
        name: 'Lead Status Changed',
        subject: 'Lead status updated: {{parentName}} → {{newStatus}}',
        variables: [
            'counselorName',
            'parentName',
            'oldStatus',
            'newStatus',
            'changeType',
        ],
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1a1a1a">Lead status updated</h2>
  <p style="color:#444;line-height:1.6">Hi {{counselorName}},</p>
  <p style="color:#444;line-height:1.6">Status for <strong>{{parentName}}</strong>
    changed from <strong>{{oldStatus}}</strong> to <strong>{{newStatus}}</strong>
    (<em>{{changeType}}</em>).</p>
</div>`,
    },
};
