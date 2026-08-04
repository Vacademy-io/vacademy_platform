-- ============================================================================
--  Seed DEFAULT EMAIL templates for mentorship notifications.
--
--  One shared global-default row per trigger (institute_id = 'DEFAULT').
--  MentorshipNotificationService resolves the email body by (institute_id, name,
--  type='EMAIL') with a 2-layer fallback: the institute's own same-named row
--  (an admin override) -> this DEFAULT row. If neither exists it falls back to
--  a plain inline body, so a deleted row never breaks sends.
--
--  Branding is NOT hardcoded — runtime placeholders are substituted per-send:
--    {{institute_name}}         -> institute.institute_name
--    {{institute_theme_color}}  -> institute.institute_theme_code (normalized #RRGGBB)
--    {{recipient_name}}         -> the email recipient's name
--    {{mentor_name}}            -> the mentor's display name
--    {{student_name}}           -> the student's name
--    {{session_title}}          -> booking/session title
--    {{session_datetime}}       -> human-readable session time
--    {{cta_url}}                -> deep link (learner portal), resolved from domain routing
--    {{support_email}}          -> institute support/from email
--
--  Idempotent: guarded by (institute_id='DEFAULT', name) NOT EXISTS.
-- ============================================================================

-- Shared branded shell is inlined per template so an admin can override one trigger
-- without affecting the others.

-- ---- 1) Mentor Assigned -> Student ----------------------------------------
INSERT INTO templates (id, type, institute_id, name, subject, content, content_type,
                       setting_json, can_delete, status, template_category, created_by, updated_by)
SELECT gen_random_uuid()::text, 'EMAIL', 'DEFAULT', 'Mentor Assigned - Student',
 'You have a new mentor on {{institute_name}}',
 $html$<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New mentor</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
 <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
   <tr><td style="background:{{institute_theme_color}};padding:22px 28px;">
     <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#ffffff;opacity:.9;">{{institute_name}}</p>
   </td></tr>
   <tr><td style="padding:32px 28px 8px;">
     <h1 style="margin:0 0 6px;font-size:22px;line-height:1.3;color:#111827;">You have a new mentor 🎉</h1>
     <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">Hi {{recipient_name}},</p>
     <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">
       <strong>{{mentor_name}}</strong> is now your mentor. You can book 1:1 sessions and message them anytime from your dashboard.</p>
     <table cellpadding="0" cellspacing="0" style="margin:6px 0 22px;"><tr><td style="border-radius:8px;background:{{institute_theme_color}};">
       <a href="{{cta_url}}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Open My Mentors</a>
     </td></tr></table>
   </td></tr>
   <tr><td style="padding:0 28px 30px;">
     <hr style="border:none;border-top:1px solid #eef1f4;margin:14px 0;">
     <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">Sent by {{institute_name}}. Questions? Reply to <a href="mailto:{{support_email}}" style="color:#6b7280;">{{support_email}}</a>.</p>
   </td></tr>
  </table>
 </td></tr></table>
</body></html>$html$,
 'text/html', NULL, TRUE, 'ACTIVE', 'TRANSACTIONAL', 'SYSTEM', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE institute_id='DEFAULT' AND name='Mentor Assigned - Student');

-- ---- 2) New Mentee -> Mentor ----------------------------------------------
INSERT INTO templates (id, type, institute_id, name, subject, content, content_type,
                       setting_json, can_delete, status, template_category, created_by, updated_by)
SELECT gen_random_uuid()::text, 'EMAIL', 'DEFAULT', 'New Mentee - Mentor',
 'A new mentee was assigned to you on {{institute_name}}',
 $html$<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New mentee</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
 <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
   <tr><td style="background:{{institute_theme_color}};padding:22px 28px;">
     <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#ffffff;opacity:.9;">{{institute_name}}</p>
   </td></tr>
   <tr><td style="padding:32px 28px 8px;">
     <h1 style="margin:0 0 6px;font-size:22px;line-height:1.3;color:#111827;">New mentee assigned</h1>
     <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">Hi {{recipient_name}},</p>
     <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">
       <strong>{{student_name}}</strong> has been assigned to you for mentorship. Open your mentee list to view their progress and start a conversation.</p>
     <table cellpadding="0" cellspacing="0" style="margin:6px 0 22px;"><tr><td style="border-radius:8px;background:{{institute_theme_color}};">
       <a href="{{cta_url}}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Open My Mentorship</a>
     </td></tr></table>
   </td></tr>
   <tr><td style="padding:0 28px 30px;">
     <hr style="border:none;border-top:1px solid #eef1f4;margin:14px 0;">
     <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">Sent by {{institute_name}}. Questions? Reply to <a href="mailto:{{support_email}}" style="color:#6b7280;">{{support_email}}</a>.</p>
   </td></tr>
  </table>
 </td></tr></table>
</body></html>$html$,
 'text/html', NULL, TRUE, 'ACTIVE', 'TRANSACTIONAL', 'SYSTEM', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE institute_id='DEFAULT' AND name='New Mentee - Mentor');

-- ---- 3) Session Booked ----------------------------------------------------
INSERT INTO templates (id, type, institute_id, name, subject, content, content_type,
                       setting_json, can_delete, status, template_category, created_by, updated_by)
SELECT gen_random_uuid()::text, 'EMAIL', 'DEFAULT', 'Mentor Session Booked',
 'Your mentor session is confirmed - {{institute_name}}',
 $html$<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Session confirmed</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
 <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
   <tr><td style="background:{{institute_theme_color}};padding:22px 28px;">
     <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#ffffff;opacity:.9;">{{institute_name}}</p>
   </td></tr>
   <tr><td style="padding:32px 28px 8px;">
     <h1 style="margin:0 0 6px;font-size:22px;line-height:1.3;color:#111827;">Your session is confirmed ✅</h1>
     <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">Hi {{recipient_name}}, your mentor session is booked. Here are the details:</p>
     <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;background:#f9fafb;border:1px solid #eef1f4;border-radius:8px;">
       <tr><td style="padding:14px 18px;font-size:14px;color:#374151;line-height:1.6;">
         <strong style="color:#111827;">{{session_title}}</strong><br>
         🗓️ {{session_datetime}}
       </td></tr>
     </table>
     <table cellpadding="0" cellspacing="0" style="margin:0 0 22px;"><tr><td style="border-radius:8px;background:{{institute_theme_color}};">
       <a href="{{cta_url}}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">View booking</a>
     </td></tr></table>
   </td></tr>
   <tr><td style="padding:0 28px 30px;">
     <hr style="border:none;border-top:1px solid #eef1f4;margin:14px 0;">
     <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">Sent by {{institute_name}}. Questions? Reply to <a href="mailto:{{support_email}}" style="color:#6b7280;">{{support_email}}</a>.</p>
   </td></tr>
  </table>
 </td></tr></table>
</body></html>$html$,
 'text/html', NULL, TRUE, 'ACTIVE', 'TRANSACTIONAL', 'SYSTEM', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE institute_id='DEFAULT' AND name='Mentor Session Booked');

-- ---- 4) Session Cancelled -------------------------------------------------
INSERT INTO templates (id, type, institute_id, name, subject, content, content_type,
                       setting_json, can_delete, status, template_category, created_by, updated_by)
SELECT gen_random_uuid()::text, 'EMAIL', 'DEFAULT', 'Mentor Session Cancelled',
 'Your mentor session was cancelled - {{institute_name}}',
 $html$<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Session cancelled</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
 <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
   <tr><td style="background:{{institute_theme_color}};padding:22px 28px;">
     <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#ffffff;opacity:.9;">{{institute_name}}</p>
   </td></tr>
   <tr><td style="padding:32px 28px 8px;">
     <h1 style="margin:0 0 6px;font-size:22px;line-height:1.3;color:#111827;">Session cancelled</h1>
     <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">Hi {{recipient_name}}, your mentor session has been cancelled:</p>
     <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;background:#f9fafb;border:1px solid #eef1f4;border-radius:8px;">
       <tr><td style="padding:14px 18px;font-size:14px;color:#374151;line-height:1.6;">
         <strong style="color:#111827;">{{session_title}}</strong><br>
         🗓️ {{session_datetime}}
       </td></tr>
     </table>
     <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#374151;">You can book another time whenever you're ready.</p>
     <table cellpadding="0" cellspacing="0" style="margin:0 0 22px;"><tr><td style="border-radius:8px;background:{{institute_theme_color}};">
       <a href="{{cta_url}}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Book again</a>
     </td></tr></table>
   </td></tr>
   <tr><td style="padding:0 28px 30px;">
     <hr style="border:none;border-top:1px solid #eef1f4;margin:14px 0;">
     <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">Sent by {{institute_name}}. Questions? Reply to <a href="mailto:{{support_email}}" style="color:#6b7280;">{{support_email}}</a>.</p>
   </td></tr>
  </table>
 </td></tr></table>
</body></html>$html$,
 'text/html', NULL, TRUE, 'ACTIVE', 'TRANSACTIONAL', 'SYSTEM', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE institute_id='DEFAULT' AND name='Mentor Session Cancelled');
