-- ============================================================================
--  Consolidate doubt-notification default templates into a SINGLE shared row
--  per event, instead of the per-institute copies V214 created.
--
--  Resolution semantics (see DoubtNotificationService.resolveTemplateId):
--    1. Admin-configured email_template_id in DOUBT_MANAGEMENT_SETTING → use it.
--    2. Institute-specific custom row (institute_id = <real id>)        → use it.
--    3. Global default row (institute_id = 'DEFAULT')               → fallback.
--
--  Institutes never need their own seeded copy. They only create rows when an
--  admin customizes. That keeps the table compact and makes content updates
--  one-row edits rather than 1009-row updates.
-- ============================================================================

-- ---- Step 1: Wipe the V214 per-institute seed copies.
-- Guard to preserve any row an admin may have edited after seeding:
--   created_by = 'system' AND updated_by = 'system' means the row has never
--   been touched through the Templates UI (which sets updated_by to the
--   acting user). Edited rows survive this DELETE.
DELETE FROM templates
WHERE type = 'EMAIL'
  AND name IN (
      'Doubt Raised - Teacher Notification',
      'Doubt Resolved - Learner Notification'
  )
  AND created_by = 'system'
  AND updated_by = 'system'
  AND institute_id <> 'DEFAULT';

-- ---- Step 2: Insert ONE global default per event.
-- institute_id = 'DEFAULT' is our sentinel. Never shown in the admin's
-- Template UI (which lists by real institute_id). Idempotent via NOT EXISTS.

INSERT INTO templates (
    id, type, institute_id, name, subject, content, content_type,
    setting_json, can_delete, status, template_category, created_by, updated_by
)
SELECT
    gen_random_uuid()::text,
    'EMAIL',
    'DEFAULT',
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
WHERE NOT EXISTS (
    SELECT 1 FROM templates
    WHERE institute_id = 'DEFAULT'
      AND name = 'Doubt Raised - Teacher Notification'
      AND type = 'EMAIL'
);

INSERT INTO templates (
    id, type, institute_id, name, subject, content, content_type,
    setting_json, can_delete, status, template_category, created_by, updated_by
)
SELECT
    gen_random_uuid()::text,
    'EMAIL',
    'DEFAULT',
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
WHERE NOT EXISTS (
    SELECT 1 FROM templates
    WHERE institute_id = 'DEFAULT'
      AND name = 'Doubt Resolved - Learner Notification'
      AND type = 'EMAIL'
);
