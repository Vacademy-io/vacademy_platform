-- ============================================================================
--  Mentorship time-based triggers: session reminder + check-in nudge.
--
--  1) mentorship_notification_log — send-once ledger for the scheduler
--     (MentorshipReminderScheduler). SESSION_REMINDER is unique per booking
--     (partial index); CHECKIN_NUDGE rows accumulate and the newest gates the
--     re-nudge cadence.
--  2) Two DEFAULT email templates, same resolution chain as V424:
--     institute's own same-named row -> these DEFAULT rows -> inline setting
--     -> code default. Placeholders identical to V424; CTAs deep-link to
--     {{cta_url}}/my-mentors. Idempotent NOT EXISTS guards.
--
--  Trigger config lives in the MENTORSHIP_SETTING blob per institute:
--    session_reminder: { enabled (default true),  hours_before (default 24),  channels... }
--    checkin_reminder: { enabled (default FALSE — opt-in), inactivity_days (default 14), channels... }
-- ============================================================================

CREATE TABLE IF NOT EXISTS mentorship_notification_log (
    id                VARCHAR(255) PRIMARY KEY,
    institute_id      VARCHAR(255) NOT NULL,
    notification_type VARCHAR(50)  NOT NULL,
    ref_id            VARCHAR(255) NOT NULL,
    sent_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One reminder per booking, race-safe: a concurrent claim loses on this index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mnl_session_reminder
    ON mentorship_notification_log (ref_id)
    WHERE notification_type = 'SESSION_REMINDER';

-- Cadence lookups (MAX(sent_at) per type+ref).
CREATE INDEX IF NOT EXISTS idx_mnl_type_ref_sent
    ON mentorship_notification_log (notification_type, ref_id, sent_at);

-- ---- 1) Mentor Session Reminder -> invitee ---------------------------------
INSERT INTO templates (id, type, institute_id, name, subject, content, content_type,
                       setting_json, can_delete, status, template_category, created_by, updated_by)
SELECT gen_random_uuid()::text, 'EMAIL', 'DEFAULT', 'Mentor Session Reminder',
 'Reminder: your mentor session is coming up - {{institute_name}}',
 $html$<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Session reminder</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
 <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
   <tr><td style="background:{{institute_theme_color}};padding:22px 28px;">
     <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#ffffff;opacity:.9;">{{institute_name}}</p>
   </td></tr>
   <tr><td style="padding:32px 28px 8px;">
     <h1 style="margin:0 0 6px;font-size:22px;line-height:1.3;color:#111827;">Your session is coming up ⏰</h1>
     <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">Hi {{recipient_name}}, a quick reminder about your upcoming mentor session:</p>
     <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;background:#f9fafb;border:1px solid #eef1f4;border-radius:8px;">
       <tr><td style="padding:14px 18px;font-size:14px;color:#374151;line-height:1.6;">
         <strong style="color:#111827;">{{session_title}}</strong><br>
         👤 with {{mentor_name}}<br>
         🗓️ {{session_datetime}}
       </td></tr>
     </table>
     <table cellpadding="0" cellspacing="0" style="margin:0 0 22px;"><tr><td style="border-radius:8px;background:{{institute_theme_color}};">
       <a href="{{cta_url}}/my-mentors" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">View session &amp; join link</a>
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
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE institute_id='DEFAULT' AND name='Mentor Session Reminder');

-- ---- 2) Mentor Check-in Reminder -> student --------------------------------
INSERT INTO templates (id, type, institute_id, name, subject, content, content_type,
                       setting_json, can_delete, status, template_category, created_by, updated_by)
SELECT gen_random_uuid()::text, 'EMAIL', 'DEFAULT', 'Mentor Check-in Reminder',
 'Time to catch up with your mentor? - {{institute_name}}',
 $html$<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Catch up with your mentor</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
 <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
   <tr><td style="background:{{institute_theme_color}};padding:22px 28px;">
     <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#ffffff;opacity:.9;">{{institute_name}}</p>
   </td></tr>
   <tr><td style="padding:32px 28px 8px;">
     <h1 style="margin:0 0 6px;font-size:22px;line-height:1.3;color:#111827;">Time to catch up with your mentor? 👋</h1>
     <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">Hi {{recipient_name}},</p>
     <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
       It's been a while since your last session with your mentor — and they're here to help.</p>
     <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px;background:#f9fafb;border:1px solid #eef1f4;border-radius:8px;">
       <tr><td style="padding:14px 18px;font-size:14px;color:#374151;line-height:1.6;">
         <span style="display:block;font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#9ca3af;">Your mentor</span>
         <strong style="font-size:16px;color:#111827;">{{mentor_name}}</strong>
       </td></tr>
     </table>
     <table cellpadding="0" cellspacing="0" style="margin:6px 0 12px;"><tr><td style="border-radius:8px;background:{{institute_theme_color}};">
       <a href="{{cta_url}}/my-mentors" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Book a 1:1 session</a>
     </td></tr></table>
     <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#6b7280;">
       Or just <a href="{{cta_url}}/my-mentors" style="color:{{institute_theme_color}};font-weight:600;text-decoration:none;">send {{mentor_name}} a message</a> — even a quick question keeps you moving.</p>
   </td></tr>
   <tr><td style="padding:0 28px 30px;">
     <hr style="border:none;border-top:1px solid #eef1f4;margin:14px 0;">
     <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">Sent by {{institute_name}}. Questions? Reply to <a href="mailto:{{support_email}}" style="color:#6b7280;">{{support_email}}</a>.</p>
   </td></tr>
  </table>
 </td></tr></table>
</body></html>$html$,
 'text/html', NULL, TRUE, 'ACTIVE', 'TRANSACTIONAL', 'SYSTEM', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE institute_id='DEFAULT' AND name='Mentor Check-in Reminder');
