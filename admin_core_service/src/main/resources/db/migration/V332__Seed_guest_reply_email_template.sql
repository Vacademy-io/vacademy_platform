-- Seed the global DEFAULT email template used when staff reply to a logged-out ("guest") query.
-- Guests can't log in, so this email IS the reply channel — the staff reply text is rendered
-- inline via {{reply_text}}. Same single-shared-row convention as V215 (institute_id='DEFAULT',
-- resolution: admin-configured id → institute override by name → this row). Idempotent via
-- NOT EXISTS. No CTA button: guests have no portal page to open.

INSERT INTO templates (
    id, type, institute_id, name, subject, content, content_type,
    setting_json, can_delete, status, template_category, created_by, updated_by
)
SELECT
    gen_random_uuid()::text,
    'EMAIL',
    'DEFAULT',
    'Doubt Reply - Guest Notification',
    'You have a reply from {{institute_name}}',
    $html$<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>You have a reply</title></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f6f8;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="background:{{institute_theme_color}};color:#ffffff;padding:20px 28px;">
          <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;opacity:0.85;">{{institute_name}}</p>
          <h1 style="margin:6px 0 0;font-size:20px;font-weight:600;">You have a reply</h1>
          <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">Our team responded to your query.</p>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 16px;font-size:15px;">Hi {{recipient_name}},</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;">
            Thanks for reaching out to {{institute_name}}. Here is the reply to your query:
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Your query</p>
              <p style="margin:0;font-size:14px;line-height:1.5;color:#111827;">{{doubt_text}}</p>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin:16px 0;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 6px;font-size:12px;color:#15803d;text-transform:uppercase;letter-spacing:0.5px;">Reply</p>
              <div style="margin:0;font-size:14px;line-height:1.5;color:#111827;">{{reply_text}}</div>
            </td></tr>
          </table>
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
            Need to follow up? Just reply to this email or write to
            <a href="mailto:{{support_email}}" style="color:#6b7280;">{{support_email}}</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$html$,
    'HTML',
    '{"email_type":"UTILITY_EMAIL"}',
    TRUE,
    'ACTIVE',
    'NOTIFICATION',
    'system',
    'system'
WHERE NOT EXISTS (
    SELECT 1 FROM templates
    WHERE institute_id = 'DEFAULT'
      AND name = 'Doubt Reply - Guest Notification'
      AND type = 'EMAIL'
);
