-- ============================================================================
--  Seed DEFAULT EMAIL templates for the two mentor-request notifications added
--  alongside the Find-a-mentor directory (V454).
--
--  Same contract as V424: one shared global-default row per trigger
--  (institute_id = 'DEFAULT'), resolved by MentorshipNotificationService as
--  institute row -> this DEFAULT row -> plain inline body. Branding is
--  substituted per-send, never hardcoded. Idempotent via NOT EXISTS.
--
--  Extra placeholder in play here:
--    {{decision_note}}  -> the admin's decline reason (HTML-escaped; blank when
--                          they didn't give one, so the paragraph collapses)
-- ============================================================================

-- ---- 1) Request received -> Mentor ----------------------------------------
INSERT INTO templates (id, type, institute_id, name, subject, content, content_type,
                       setting_json, can_delete, status, template_category, created_by, updated_by)
SELECT gen_random_uuid()::text, 'EMAIL', 'DEFAULT', 'Mentor Request Received - Mentor',
 'A learner requested you as their mentor on {{institute_name}}',
 $html$<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New mentorship request</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
 <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
   <tr><td style="background:{{institute_theme_color}};padding:22px 28px;">
     <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#ffffff;opacity:.9;">{{institute_name}}</p>
   </td></tr>
   <tr><td style="padding:32px 28px 8px;">
     <h1 style="margin:0 0 6px;font-size:22px;line-height:1.3;color:#111827;">New mentorship request</h1>
     <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">Hi {{recipient_name}},</p>
     <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">
       <strong>{{student_name}}</strong> has asked to be mentored by you. Your admin will confirm the pairing &mdash; nothing is needed from you yet.</p>
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
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE institute_id='DEFAULT' AND name='Mentor Request Received - Mentor');

-- ---- 2) Request declined -> Student ---------------------------------------
--  Deliberately warm and non-final: the learner can request someone else, and the
--  CTA takes them straight back to the directory rather than leaving a dead end.
INSERT INTO templates (id, type, institute_id, name, subject, content, content_type,
                       setting_json, can_delete, status, template_category, created_by, updated_by)
SELECT gen_random_uuid()::text, 'EMAIL', 'DEFAULT', 'Mentor Request Declined',
 'About your mentor request on {{institute_name}}',
 $html$<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mentor request update</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
 <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
   <tr><td style="background:{{institute_theme_color}};padding:22px 28px;">
     <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#ffffff;opacity:.9;">{{institute_name}}</p>
   </td></tr>
   <tr><td style="padding:32px 28px 8px;">
     <h1 style="margin:0 0 6px;font-size:22px;line-height:1.3;color:#111827;">About your mentor request</h1>
     <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">Hi {{recipient_name}},</p>
     <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">
       Your request for a mentor wasn&rsquo;t taken forward this time. {{decision_note}}</p>
     <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">
       There are other mentors you can reach out to &mdash; browse them and request whoever fits what you&rsquo;re working on.</p>
     <table cellpadding="0" cellspacing="0" style="margin:6px 0 22px;"><tr><td style="border-radius:8px;background:{{institute_theme_color}};">
       <a href="{{cta_url}}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Find a mentor</a>
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
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE institute_id='DEFAULT' AND name='Mentor Request Declined');
