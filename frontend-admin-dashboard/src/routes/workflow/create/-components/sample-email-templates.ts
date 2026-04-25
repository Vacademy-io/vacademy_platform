/**
 * Pre-built sample email templates for each use-case.
 * When user clicks "Use sample template", we create this in their template library
 * so the SEND_EMAIL handler can look it up by name.
 */

export interface SampleEmailTemplate {
  name: string;
  subject: string;
  html: string;
  variables: string[];
}

/** Map of use-case template ID → sample email template */
export const SAMPLE_TEMPLATES: Record<string, SampleEmailTemplate> = {

  // ─── Enrollment ───

  email_batch_students: {
    name: 'Batch Notification',
    subject: 'Important Update for You, {{fullName}}',
    variables: ['fullName', 'email', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <h2 style="color:#1a1a1a;margin-bottom:16px">Hello {{fullName}},</h2>
  <p style="color:#444;line-height:1.6">We have an important update for you. Please check your dashboard for more details.</p>
  <p style="color:#444;line-height:1.6">If you have any questions, feel free to reach out to us.</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Best regards,<br/>{{instituteName}}</p>
</div>`,
  },

  welcome_enrolled_student: {
    name: 'Welcome - New Student',
    subject: 'Welcome {{fullName}}! Your enrollment is confirmed',
    variables: ['fullName', 'email', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <div style="text-align:center;padding:24px 0">
    <h1 style="color:#2563eb;margin:0">Welcome Aboard!</h1>
  </div>
  <h2 style="color:#1a1a1a">Hi {{fullName}},</h2>
  <p style="color:#444;line-height:1.6">Congratulations! Your enrollment has been confirmed. We're excited to have you with us.</p>
  <p style="color:#444;line-height:1.6">Here's what to do next:</p>
  <ul style="color:#444;line-height:1.8">
    <li>Log in to your student dashboard</li>
    <li>Complete your profile</li>
    <li>Explore your courses and materials</li>
  </ul>
  <p style="color:#444;line-height:1.6">If you need help getting started, our team is here for you.</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Best regards,<br/>{{instituteName}}</p>
</div>`,
  },

  email_parents_batch: {
    name: 'Parent Notification',
    subject: 'Update about {{fullName}}',
    variables: ['fullName', 'email', 'parentsEmail', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <h2 style="color:#1a1a1a">Dear Parent,</h2>
  <p style="color:#444;line-height:1.6">We would like to inform you about an important update regarding your child <strong>{{fullName}}</strong>.</p>
  <p style="color:#444;line-height:1.6">Please check the student portal for details or contact us if you have questions.</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Best regards,<br/>{{instituteName}}</p>
</div>`,
  },

  termination_notice: {
    name: 'Membership Removal Notice',
    subject: '{{fullName}}, your membership has been updated',
    variables: ['fullName', 'email', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <h2 style="color:#1a1a1a">Hi {{fullName}},</h2>
  <p style="color:#444;line-height:1.6">We're writing to let you know that your membership status has been updated. Your access has been removed from the organization.</p>
  <p style="color:#444;line-height:1.6">If you believe this is an error or have questions, please contact the administrator.</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Best regards,<br/>{{instituteName}}</p>
</div>`,
  },

  // ─── Audience / CRM ───

  audience_lead_confirmation: {
    name: 'Lead Confirmation',
    subject: 'Thank you for your interest, {{parentName}}!',
    variables: ['parentName', 'email', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <div style="text-align:center;padding:24px 0">
    <h1 style="color:#16a34a;margin:0">Thank You!</h1>
  </div>
  <h2 style="color:#1a1a1a">Hi {{parentName}},</h2>
  <p style="color:#444;line-height:1.6">Thank you for your interest! We've received your enquiry and our team will get back to you shortly.</p>
  <p style="color:#444;line-height:1.6">In the meantime, feel free to explore our website to learn more about our programs.</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Best regards,<br/>{{instituteName}}</p>
</div>`,
  },

  lead_followup_email: {
    name: 'Lead Follow-up',
    subject: '{{parentName}}, following up on your enquiry',
    variables: ['parentName', 'email', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <h2 style="color:#1a1a1a">Hi {{parentName}},</h2>
  <p style="color:#444;line-height:1.6">We noticed you recently showed interest in our programs. We wanted to follow up and see if you have any questions.</p>
  <p style="color:#444;line-height:1.6">Our team is ready to help you with:</p>
  <ul style="color:#444;line-height:1.8">
    <li>Course information and curriculum details</li>
    <li>Fee structure and payment options</li>
    <li>Admission process and timelines</li>
  </ul>
  <p style="color:#444;line-height:1.6">Simply reply to this email or call us to get started!</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Best regards,<br/>{{instituteName}}</p>
</div>`,
  },

  // ─── Payment ───

  payment_failed_email: {
    name: 'Payment Failed Alert',
    subject: '{{fullName}}, payment issue - action required',
    variables: ['fullName', 'email', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:24px">
    <h2 style="color:#dc2626;margin:0 0 8px 0">Payment Failed</h2>
    <p style="color:#991b1b;margin:0">Your recent payment could not be processed.</p>
  </div>
  <p style="color:#444;line-height:1.6">Hi <strong>{{fullName}}</strong>,</p>
  <p style="color:#444;line-height:1.6">We were unable to process your payment. This may happen due to insufficient funds, card expiry, or a temporary bank issue.</p>
  <p style="color:#444;line-height:1.6"><strong>What to do next:</strong></p>
  <ol style="color:#444;line-height:1.8">
    <li>Check your payment method details</li>
    <li>Ensure sufficient balance is available</li>
    <li>Try the payment again from your dashboard</li>
  </ol>
  <p style="color:#444;line-height:1.6">If the issue persists, please contact our support team.</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Best regards,<br/>{{instituteName}}</p>
</div>`,
  },

  abandoned_cart_reminder: {
    name: 'Complete Your Enrollment',
    subject: '{{fullName}}, you\'re almost there! Complete your enrollment',
    variables: ['fullName', 'email', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <h2 style="color:#1a1a1a">Hi {{fullName}},</h2>
  <p style="color:#444;line-height:1.6">We noticed you started your enrollment but didn't complete the payment. Your spot is still available!</p>
  <p style="color:#444;line-height:1.6">Complete your enrollment now to secure your place and get started right away.</p>
  <div style="text-align:center;margin:32px 0">
    <a style="background:#2563eb;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Complete Enrollment</a>
  </div>
  <p style="color:#888;font-size:13px">If you have questions about fees or need assistance, just reply to this email.</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Best regards,<br/>{{instituteName}}</p>
</div>`,
  },

  // ─── Live Session ───

  session_start_reminder: {
    name: 'Live Session Starting',
    subject: '{{fullName}}, your live session is starting!',
    variables: ['fullName', 'email', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center">
    <h2 style="color:#2563eb;margin:0">Live Session Starting Now!</h2>
  </div>
  <p style="color:#444;line-height:1.6">Hi <strong>{{fullName}}</strong>,</p>
  <p style="color:#444;line-height:1.6">Your live session is starting. Join now to not miss anything!</p>
  <p style="color:#444;line-height:1.6">Make sure you have a stable internet connection and your audio/video is working.</p>
  <p style="color:#888;font-size:13px;margin-top:32px">See you there!</p>
</div>`,
  },

  post_session_followup: {
    name: 'Post-Session Follow-up',
    subject: '{{fullName}}, session complete - recording & next steps',
    variables: ['fullName', 'email', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <h2 style="color:#1a1a1a">Hi {{fullName}},</h2>
  <p style="color:#444;line-height:1.6">Thank you for attending today's session! Here's a quick summary:</p>
  <ul style="color:#444;line-height:1.8">
    <li>Session recording will be available in your dashboard</li>
    <li>Review the materials shared during the session</li>
    <li>Complete any assignments before the next session</li>
  </ul>
  <p style="color:#444;line-height:1.6">We'd love to hear your feedback. Please take a moment to share your thoughts.</p>
  <p style="color:#888;font-size:13px;margin-top:32px">See you next time!<br/>{{instituteName}}</p>
</div>`,
  },

  // ─── Fee Reminder ───

  scheduled_fee_reminder: {
    name: 'Fee Payment Reminder',
    subject: 'Fee payment reminder - {{dueDate}}',
    variables: ['studentName', 'recipientName', 'dueDate', 'remainingAmount', 'amountExpected', 'amountPaid', 'installmentNumber', 'reminderType', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:24px">
    <h2 style="color:#d97706;margin:0">Fee Payment Reminder</h2>
  </div>
  <p style="color:#444;line-height:1.6">Dear <strong>{{recipientName}}</strong>,</p>
  <p style="color:#444;line-height:1.6">This is a reminder for the upcoming fee payment for <strong>{{studentName}}</strong>.</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0">
    <tr style="background:#f8fafc"><td style="padding:10px;border:1px solid #e2e8f0;font-weight:bold;color:#444">Due Date</td><td style="padding:10px;border:1px solid #e2e8f0;color:#444">{{dueDate}}</td></tr>
    <tr><td style="padding:10px;border:1px solid #e2e8f0;font-weight:bold;color:#444">Total Amount</td><td style="padding:10px;border:1px solid #e2e8f0;color:#444">{{amountExpected}}</td></tr>
    <tr style="background:#f8fafc"><td style="padding:10px;border:1px solid #e2e8f0;font-weight:bold;color:#444">Already Paid</td><td style="padding:10px;border:1px solid #e2e8f0;color:#444">{{amountPaid}}</td></tr>
    <tr><td style="padding:10px;border:1px solid #e2e8f0;font-weight:bold;color:#dc2626">Remaining</td><td style="padding:10px;border:1px solid #e2e8f0;color:#dc2626;font-weight:bold">{{remainingAmount}}</td></tr>
  </table>
  <p style="color:#444;line-height:1.6">Please ensure the payment is made before the due date to avoid any late fees.</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Best regards,<br/>{{instituteName}}</p>
</div>`,
  },

  // ─── Reports ───

  scheduled_batch_report: {
    name: 'Attendance Report',
    subject: '{{fullName}}, your attendance report ({{startDate}} - {{endDate}})',
    variables: ['fullName', 'email', 'attendancePercentage', 'sessionsAttended', 'startDate', 'endDate', 'sessionsTableHtml', 'totalDurationMinutes', 'instituteName', 'reportUrl'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <h2 style="color:#1a1a1a">Attendance Report</h2>
  <p style="color:#444;line-height:1.6">Hi <strong>{{fullName}}</strong>, here's your attendance summary for <strong>{{startDate}}</strong> to <strong>{{endDate}}</strong>:</p>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;text-align:center;margin:20px 0">
    <div style="font-size:44px;font-weight:bold;color:#16a34a;line-height:1.2">{{attendancePercentage}}%</div>
    <div style="color:#444;margin-top:12px;font-size:14px">Attendance Rate</div>
    <div style="color:#666;margin-top:6px;font-size:13px">{{sessionsAttended}} sessions attended &middot; {{totalDurationMinutes}} min total</div>
  </div>
  <h3 style="color:#1e293b;margin-top:24px">Session Details</h3>
  {{sessionsTableHtml}}
  <div style="text-align:center;margin:24px 0">
    <a href="{{reportUrl}}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View Full Report &amp; Download PDF</a>
  </div>
  <p style="color:#444;line-height:1.6;margin-top:16px">Regular attendance is the key to success.</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Best regards,<br/>{{instituteName}}</p>
  <p style="border-top:1px solid #e2e8f0;margin-top:24px;padding-top:12px;color:#94a3b8;font-size:11px;line-height:1.5">
    <strong>* Engagement Score</strong> = 80 pts attendance time + 20 pts interactions (chats, talks, raises, emojis, polls). View the full report for a per-session breakdown.
  </p>
</div>`,
  },

  scheduled_engagement_summary: {
    name: 'Engagement Summary',
    subject: '{{fullName}}, your weekly engagement report',
    variables: ['fullName', 'attendancePercentage', 'sessionsAttended', 'totalDurationMinutes', 'totalChats', 'totalHandRaises', 'startDate', 'endDate', 'sessionsTableHtml', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <h2 style="color:#1a1a1a">Weekly Engagement Report</h2>
  <p style="color:#444;line-height:1.6">Hi <strong>{{fullName}}</strong>, here's how you engaged this week:</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0">
    <tr>
      <td style="background:#eff6ff;border-radius:8px;padding:16px;text-align:center;width:25%">
        <div style="font-size:28px;font-weight:bold;color:#2563eb">{{attendancePercentage}}%</div>
        <div style="color:#64748b;font-size:12px;margin-top:4px">Attendance</div>
      </td>
      <td style="width:4%"></td>
      <td style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;width:21%">
        <div style="font-size:28px;font-weight:bold;color:#16a34a">{{sessionsAttended}}</div>
        <div style="color:#64748b;font-size:12px;margin-top:4px">Sessions</div>
      </td>
      <td style="width:4%"></td>
      <td style="background:#fefce8;border-radius:8px;padding:16px;text-align:center;width:21%">
        <div style="font-size:28px;font-weight:bold;color:#ca8a04">{{totalDurationMinutes}}</div>
        <div style="color:#64748b;font-size:12px;margin-top:4px">Minutes</div>
      </td>
      <td style="width:4%"></td>
      <td style="background:#fdf2f8;border-radius:8px;padding:16px;text-align:center;width:21%">
        <div style="font-size:28px;font-weight:bold;color:#db2777">{{totalChats}}</div>
        <div style="color:#64748b;font-size:12px;margin-top:4px">Chats</div>
      </td>
    </tr>
  </table>
  <h3 style="color:#1e293b;margin-top:24px">Session Details</h3>
  {{sessionsTableHtml}}
  <p style="color:#444;line-height:1.6;margin-top:16px">Period: {{startDate}} to {{endDate}}</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Keep learning!<br/>{{instituteName}}</p>
</div>`,
  },

  scheduled_parents_attendance: {
    name: 'Parent Attendance Update',
    subject: '{{fullName}}\'s weekly attendance update ({{startDate}} - {{endDate}})',
    variables: ['fullName', 'attendancePercentage', 'sessionsAttended', 'startDate', 'endDate', 'sessionsTableHtml', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <h2 style="color:#1a1a1a">Weekly Attendance Update</h2>
  <p style="color:#444;line-height:1.6">Dear Parent,</p>
  <p style="color:#444;line-height:1.6">Here is the weekly attendance summary for <strong>{{fullName}}</strong> ({{startDate}} - {{endDate}}):</p>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;text-align:center;margin:20px 0">
    <div style="font-size:44px;font-weight:bold;color:#16a34a;line-height:1.2">{{attendancePercentage}}%</div>
    <div style="color:#444;margin-top:12px;font-size:14px">Attendance Rate</div>
    <div style="color:#666;margin-top:6px;font-size:13px">{{sessionsAttended}} sessions attended</div>
  </div>
  <h3 style="color:#1e293b;margin-top:24px">Session Details</h3>
  {{sessionsTableHtml}}
  <p style="color:#444;line-height:1.6;margin-top:16px">If you have any concerns about attendance, please reach out to us.</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Best regards,<br/>{{instituteName}}</p>
</div>`,
  },

  // ─── Membership ───

  membership_expiry_reminder: {
    name: 'Membership Expiry Reminder',
    subject: '{{fullName}}, your membership is expiring soon',
    variables: ['fullName', 'email', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center">
    <h2 style="color:#dc2626;margin:0">Membership Expiring Soon</h2>
  </div>
  <p style="color:#444;line-height:1.6">Hi <strong>{{fullName}}</strong>,</p>
  <p style="color:#444;line-height:1.6">Your membership is about to expire. Renew now to continue enjoying uninterrupted access to all your courses and materials.</p>
  <div style="text-align:center;margin:32px 0">
    <a style="background:#2563eb;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Renew Now</a>
  </div>
  <p style="color:#888;font-size:13px">Don't lose your progress! Renewing takes just a minute.</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Best regards,<br/>{{instituteName}}</p>
</div>`,
  },

  scheduled_expiry_check: {
    name: 'Membership Renewal Reminder',
    subject: '{{fullName}}, renew your membership',
    variables: ['fullName', 'email', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <h2 style="color:#1a1a1a">Hi {{fullName}},</h2>
  <p style="color:#444;line-height:1.6">Your membership will expire soon. Renew today to continue accessing your courses without interruption.</p>
  <p style="color:#444;line-height:1.6">Contact us if you have any questions about renewal options.</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Best regards,<br/>{{instituteName}}</p>
</div>`,
  },

  // ─── Assessment ───

  assessment_created_notify: {
    name: 'New Assessment Available',
    subject: '{{fullName}}, new assessment available for you',
    variables: ['fullName', 'email', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center">
    <h2 style="color:#2563eb;margin:0">New Assessment Available</h2>
  </div>
  <p style="color:#444;line-height:1.6">Hi <strong>{{fullName}}</strong>,</p>
  <p style="color:#444;line-height:1.6">A new assessment has been published for you. Log in to your dashboard to view the details and start the assessment.</p>
  <p style="color:#444;line-height:1.6">Good luck!</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Best regards,<br/>{{instituteName}}</p>
</div>`,
  },

  assessment_email_batch: {
    name: 'Assessment Completion',
    subject: '{{fullName}}, assessment submitted successfully',
    variables: ['fullName', 'email', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <div style="text-align:center;padding:24px 0">
    <h1 style="color:#16a34a;margin:0">Assessment Submitted!</h1>
  </div>
  <p style="color:#444;line-height:1.6">Hi <strong>{{fullName}}</strong>,</p>
  <p style="color:#444;line-height:1.6">Your assessment has been submitted successfully. Results will be shared once the evaluation is complete.</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Best regards,<br/>{{instituteName}}</p>
</div>`,
  },

  // ─── Invites ───

  invite_notify_batch: {
    name: 'New Enrollment Invite',
    subject: 'New enrollment opportunity',
    variables: ['fullName', 'email', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <h2 style="color:#1a1a1a">Hi {{fullName}},</h2>
  <p style="color:#444;line-height:1.6">A new enrollment invite has been created. Check your dashboard for details and enrollment instructions.</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Best regards,<br/>{{instituteName}}</p>
</div>`,
  },

  // ─── Scheduled audience ───

  scheduled_audience_followup: {
    name: 'Audience Follow-up',
    subject: '{{parentName}}, we haven\'t heard from you',
    variables: ['parentName', 'email', 'instituteName'],
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <h2 style="color:#1a1a1a">Hi {{parentName}},</h2>
  <p style="color:#444;line-height:1.6">We noticed you recently enquired about our programs. We wanted to check if you have any questions or need more information.</p>
  <p style="color:#444;line-height:1.6">Our admissions team is happy to help with anything you need. Simply reply to this email!</p>
  <p style="color:#888;font-size:13px;margin-top:32px">Best regards,<br/>{{instituteName}}</p>
</div>`,
  },
};
