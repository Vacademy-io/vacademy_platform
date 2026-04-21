-- ============================================================================
--  Seed EMAIL templates for Doubt Management notifications.
--
--  For every institute this migration inserts two EMAIL templates (raised /
--  resolved). DoubtNotificationService looks them up by
--  (institute_id, name, type) — id is a random UUID, not derived from any key.
--  That's because templates.id is VARCHAR(36); a "doubt-raised-tpl-<uuid>"
--  scheme overflows it.
--
--  Branding is NOT hardcoded — the templates contain runtime placeholders
--  that DoubtNotificationService substitutes per-send:
--    {{institute_theme_color}} → institute.institute_theme_code (normalized to
--                                 #RRGGBB, default #FF9800 when unset)
--    {{institute_name}}        → institute.institute_name
--    {{support_email}}         → institute.setting.EMAIL_SETTING.UTILITY_EMAIL.from
--                                 (fallback: support@vacademy.io)
--    {{recipient_name}}        → UserDTO.fullName of the email recipient
--    {{doubt_text}}            → first 200 chars of the doubt's html_text
--    {{doubt_id}}, {{batch_id}}, {{student_id}} → from the doubt row
--
--  Idempotent: guarded by (institute_id, name) NOT EXISTS. Re-running or
--  repair does not duplicate rows. gen_random_uuid() is available in the
--  PostgreSQL 13+ core — no pgcrypto extension required.
-- ============================================================================

-- ---- Template 1: Doubt Raised (to assigned teacher) -----------------------
INSERT INTO templates (
    id, type, institute_id, name, subject, content, content_type,
    setting_json, can_delete, status, template_category, created_by, updated_by
)
SELECT
    gen_random_uuid()::text,
    'EMAIL',
    i.id,
    'Doubt Raised - Teacher Notification',
    'New doubt raised on {{institute_name}} - please review',
    $html$<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>New doubt raised</title></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f6f8;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="background:{{institute_theme_color}};color:#ffffff;padding:20px 28px;">
          <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;opacity:0.85;">{{institute_name}}</p>
          <h1 style="margin:6px 0 0;font-size:20px;font-weight:600;">New doubt raised</h1>
          <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">A learner is waiting for your help.</p>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 16px;font-size:15px;">Hi {{recipient_name}},</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;">
            A new doubt has been raised on one of your batches and you've been assigned to resolve it.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Doubt</p>
              <p style="margin:0;font-size:14px;line-height:1.5;color:#111827;">{{doubt_text}}</p>
            </td></tr>
          </table>
          <p style="margin:16px 0 8px;font-size:13px;color:#6b7280;">
            <strong style="color:#374151;">Batch:</strong> {{batch_id}}<br>
            <strong style="color:#374151;">Doubt ID:</strong> {{doubt_id}}
          </p>
          <div style="margin:28px 0 8px;">
            <a href="#" style="display:inline-block;background:{{institute_theme_color}};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">Open doubt</a>
          </div>
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
            You're receiving this because {{institute_name}} enabled email alerts for new doubts.
            Questions? Write to <a href="mailto:{{support_email}}" style="color:#6b7280;">{{support_email}}</a>.
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
FROM institutes i
WHERE NOT EXISTS (
    SELECT 1 FROM templates t
    WHERE t.institute_id = i.id
      AND t.name = 'Doubt Raised - Teacher Notification'
      AND t.type = 'EMAIL'
  );

-- ---- Template 2: Doubt Resolved (to student) ------------------------------
INSERT INTO templates (
    id, type, institute_id, name, subject, content, content_type,
    setting_json, can_delete, status, template_category, created_by, updated_by
)
SELECT
    gen_random_uuid()::text,
    'EMAIL',
    i.id,
    'Doubt Resolved - Learner Notification',
    'Your doubt on {{institute_name}} has been resolved',
    $html$<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Your doubt was resolved</title></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f6f8;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="background:{{institute_theme_color}};color:#ffffff;padding:20px 28px;">
          <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;opacity:0.85;">{{institute_name}}</p>
          <h1 style="margin:6px 0 0;font-size:20px;font-weight:600;">Your doubt was resolved ✓</h1>
          <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">A teacher has replied.</p>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 16px;font-size:15px;">Hi {{recipient_name}},</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;">
            Good news — your doubt on {{institute_name}} has been resolved. Open it in the app to see the reply from your teacher.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Your original doubt</p>
              <p style="margin:0;font-size:14px;line-height:1.5;color:#111827;">{{doubt_text}}</p>
            </td></tr>
          </table>
          <p style="margin:16px 0 8px;font-size:13px;color:#6b7280;">
            <strong style="color:#374151;">Doubt ID:</strong> {{doubt_id}}
          </p>
          <div style="margin:28px 0 8px;">
            <a href="#" style="display:inline-block;background:{{institute_theme_color}};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">See the reply</a>
          </div>
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
            If you still have follow-up questions, you can reply on the same doubt thread inside the app.
            Need help? Write to <a href="mailto:{{support_email}}" style="color:#6b7280;">{{support_email}}</a>.
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
FROM institutes i
WHERE NOT EXISTS (
    SELECT 1 FROM templates t
    WHERE t.institute_id = i.id
      AND t.name = 'Doubt Resolved - Learner Notification'
      AND t.type = 'EMAIL'
  );
