-- ============================================================================
--  Seed the DEFAULT branded EMAIL template for booking confirmations.
--
--  MeetingBookingService sends this to BOTH the invitee and the host (admin) when
--  a booking is created. Resolved by (institute_id, name='Booking Confirmation',
--  type='EMAIL') with a DEFAULT fallback via BrandedEmailService; falls back to a
--  plain inline body only when no row exists.
--
--  Placeholders (substituted per-recipient at send time, nothing hardcoded):
--    {{recipient_name}}         -> the email recipient's name (invitee or host)
--    {{meeting_title}}          -> booking title
--    {{session_datetime}}       -> human-readable start time (with timezone)
--    {{status_label}}           -> 'confirmed' | 'awaiting confirmation'
--    {{join_button}}            -> pre-rendered Join button HTML, or '' when no link
--    {{institute_name}}         -> institute.institute_name
--    {{institute_theme_color}}  -> institute.institute_theme_code (normalized #RRGGBB)
--    {{support_email}}          -> support/from email
--
--  Idempotent: guarded by (institute_id='DEFAULT', name) NOT EXISTS.
-- ============================================================================

INSERT INTO templates (id, type, institute_id, name, subject, content, content_type,
                       setting_json, can_delete, status, template_category, created_by, updated_by)
SELECT gen_random_uuid()::text, 'EMAIL', 'DEFAULT', 'Booking Confirmation',
 'Your meeting is {{status_label}} - {{meeting_title}}',
 $html$<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Meeting confirmation</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
 <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
   <tr><td style="background:{{institute_theme_color}};padding:22px 28px;">
     <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#ffffff;opacity:.9;">{{institute_name}}</p>
   </td></tr>
   <tr><td style="padding:32px 28px 8px;">
     <h1 style="margin:0 0 6px;font-size:22px;line-height:1.3;color:#111827;">Your meeting is {{status_label}}</h1>
     <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">Hi {{recipient_name}},</p>
     <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">Your meeting is {{status_label}}. Here are the details:</p>
     <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;background:#f9fafb;border:1px solid #eef1f4;border-radius:8px;">
       <tr><td style="padding:14px 18px;font-size:14px;color:#374151;line-height:1.7;">
         <strong style="color:#111827;font-size:15px;">{{meeting_title}}</strong><br>
         🗓️ {{session_datetime}}
       </td></tr>
     </table>
     {{join_button}}
   </td></tr>
   <tr><td style="padding:0 28px 30px;">
     <hr style="border:none;border-top:1px solid #eef1f4;margin:14px 0;">
     <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">Sent by {{institute_name}}. Questions? Reply to <a href="mailto:{{support_email}}" style="color:#6b7280;">{{support_email}}</a>.</p>
   </td></tr>
  </table>
 </td></tr></table>
</body></html>$html$,
 'text/html', NULL, TRUE, 'ACTIVE', 'TRANSACTIONAL', 'SYSTEM', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE institute_id='DEFAULT' AND name='Booking Confirmation');
