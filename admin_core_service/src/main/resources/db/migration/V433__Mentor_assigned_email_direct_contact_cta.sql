-- ============================================================================
--  Mentorship emails: deep-link straight to the learner's My Mentors page.
--
--  The V424 seed linked every CTA to {{cta_url}} (the learner-portal root),
--  leaving the student to hunt for the mentor themselves. The learner app now
--  auto-surfaces a "My Mentors" sidebar tab whenever a mentor is assigned, so:
--   1) "Mentor Assigned - Student" is rebuilt around direct contact — a
--      mentor card plus a "Message your mentor" CTA that lands on
--      {{cta_url}}/my-mentors (message + book live there).
--   2) The Session Booked / Cancelled CTAs are re-pointed from the portal
--      root to {{cta_url}}/my-mentors.
--
--  Only the shared DEFAULT rows are touched (institute_id = 'DEFAULT');
--  institute-specific overrides always win at resolve time and are never
--  modified here. Placeholders are unchanged from V424. Idempotent: the
--  UPDATEs converge (REPLACE no-ops once the href already carries the path).
-- ============================================================================

-- ---- 1) Mentor Assigned -> Student: direct-contact layout ------------------
UPDATE templates
SET subject = 'You have a new mentor on {{institute_name}}',
    content = $html$<!DOCTYPE html>
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
     <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
       <strong>{{mentor_name}}</strong> is now your personal mentor and is ready to help you with your learning journey.</p>
     <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px;background:#f9fafb;border:1px solid #eef1f4;border-radius:8px;">
       <tr><td style="padding:14px 18px;font-size:14px;color:#374151;line-height:1.6;">
         <span style="display:block;font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#9ca3af;">Your mentor</span>
         <strong style="font-size:16px;color:#111827;">{{mentor_name}}</strong>
       </td></tr>
     </table>
     <table cellpadding="0" cellspacing="0" style="margin:6px 0 12px;"><tr><td style="border-radius:8px;background:{{institute_theme_color}};">
       <a href="{{cta_url}}/my-mentors" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Message your mentor</a>
     </td></tr></table>
     <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#6b7280;">
       You can also <a href="{{cta_url}}/my-mentors" style="color:{{institute_theme_color}};font-weight:600;text-decoration:none;">book a 1:1 session</a> — find {{mentor_name}} anytime under <strong>My Mentors</strong> in your dashboard sidebar.</p>
   </td></tr>
   <tr><td style="padding:0 28px 30px;">
     <hr style="border:none;border-top:1px solid #eef1f4;margin:14px 0;">
     <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">Sent by {{institute_name}}. Questions? Reply to <a href="mailto:{{support_email}}" style="color:#6b7280;">{{support_email}}</a>.</p>
   </td></tr>
  </table>
 </td></tr></table>
</body></html>$html$
WHERE institute_id = 'DEFAULT'
  AND name = 'Mentor Assigned - Student'
  AND type = 'EMAIL';

-- ---- 2) Session Booked / Cancelled: land on My Mentors ---------------------
UPDATE templates
SET content = REPLACE(content, 'href="{{cta_url}}"', 'href="{{cta_url}}/my-mentors"')
WHERE institute_id = 'DEFAULT'
  AND name IN ('Mentor Session Booked', 'Mentor Session Cancelled')
  AND type = 'EMAIL';
