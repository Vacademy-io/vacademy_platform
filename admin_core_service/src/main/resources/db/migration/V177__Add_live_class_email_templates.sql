-- Migration: Add default email templates for live class notifications
-- Each institute can override these by inserting their own templates + event configs

-- 1. Insert default templates for live class notifications

-- ON_CREATE template
INSERT INTO templates (id, type, institute_id, name, subject, content, content_type, template_category, can_delete, dynamic_parameters, status, created_by, updated_by)
VALUES (
    'default-live-class-on-create-email',
    'EMAIL',
    'DEFAULT',
    'Live Class Created Email',
    'New Live Class Created - {{SESSION_TITLE}}',
    '<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Live Class Invitation</title>
  </head>
  <body style="margin:0; padding:0; background-color:#fdf5f2; font-family: Arial, sans-serif;">
    <table role="presentation" style="width:100%; border-collapse:collapse; background-color:#fdf5f2; padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" style="width:600px; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
            <tr>
              <td style="background:{{THEME_COLOR}}; padding:20px; text-align:center; color:#fff;">
                <h1 style="margin:0; font-size:24px;">📢 Live Class {{ACTION}}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; color:#333;">
                <p style="font-size:16px;">Hi <strong>{{NAME}}</strong>,</p>
                <p style="font-size:16px; line-height:1.6;">
                  We''re excited to invite you to our upcoming <strong>{{SESSION_TITLE}}</strong>, designed to help you learn and grow with us.
                </p>
                <p style="font-size:14px; font-weight:bold; color:#555; margin-bottom:8px;">🕐 Schedule (by Time Zone):</p>
                <table role="presentation" style="margin:0 0 20px 0; width:100%;">
                  <tr>
                    <td style="padding:16px; background:#fff3ec; border:1px solid #ffe0d1; border-radius:8px;">
                      {{ALL_TIMEZONE_TIMES}}
                    </td>
                  </tr>
                </table>
                <div style="text-align:center; margin:30px 0;">
                  <a href="{{LINK}}" target="_blank"
                     style="display:inline-block; padding:12px 24px; background:{{THEME_COLOR}}; color:#fff;
                            font-size:16px; font-weight:bold; text-decoration:none; border-radius:6px;">
                    Join the Live Class
                  </a>
                </div>
                <p style="font-size:15px; line-height:1.6;">
                  We look forward to seeing you there!
                </p>
                <p style="font-size:15px; line-height:1.6; margin-top:20px;">
                  Best regards,<br/>
                  <strong>Your Team</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#fbeae3; text-align:center; padding:15px; font-size:12px; color:#777;">
                © 2025 Your Organization. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>',
    'HTML',
    'LIVE_CLASS',
    false,
    '["NAME", "SESSION_TITLE", "ACTION", "LINK", "THEME_COLOR", "ALL_TIMEZONE_TIMES", "DATE", "TIME"]',
    'ACTIVE',
    'system',
    'system'
);

-- BEFORE_LIVE template
INSERT INTO templates (id, type, institute_id, name, subject, content, content_type, template_category, can_delete, dynamic_parameters, status, created_by, updated_by)
VALUES (
    'default-live-class-before-live-email',
    'EMAIL',
    'DEFAULT',
    'Live Class Starting Soon Email',
    'Get Ready! Your session begins shortly.',
    '<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Live Class Invitation</title>
  </head>
  <body style="margin:0; padding:0; background-color:#fdf5f2; font-family: Arial, sans-serif;">
    <table role="presentation" style="width:100%; border-collapse:collapse; background-color:#fdf5f2; padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" style="width:600px; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
            <tr>
              <td style="background:{{THEME_COLOR}}; padding:20px; text-align:center; color:#fff;">
                <h1 style="margin:0; font-size:24px;">📢 Live Class {{ACTION}}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; color:#333;">
                <p style="font-size:16px;">Hi <strong>{{NAME}}</strong>,</p>
                <p style="font-size:16px; line-height:1.6;">
                  We''re excited to invite you to our upcoming <strong>{{SESSION_TITLE}}</strong>, designed to help you learn and grow with us.
                </p>
                <p style="font-size:14px; font-weight:bold; color:#555; margin-bottom:8px;">🕐 Schedule (by Time Zone):</p>
                <table role="presentation" style="margin:0 0 20px 0; width:100%;">
                  <tr>
                    <td style="padding:16px; background:#fff3ec; border:1px solid #ffe0d1; border-radius:8px;">
                      {{ALL_TIMEZONE_TIMES}}
                    </td>
                  </tr>
                </table>
                <div style="text-align:center; margin:30px 0;">
                  <a href="{{LINK}}" target="_blank"
                     style="display:inline-block; padding:12px 24px; background:{{THEME_COLOR}}; color:#fff;
                            font-size:16px; font-weight:bold; text-decoration:none; border-radius:6px;">
                    Join the Live Class
                  </a>
                </div>
                <p style="font-size:15px; line-height:1.6;">
                  We look forward to seeing you there!
                </p>
                <p style="font-size:15px; line-height:1.6; margin-top:20px;">
                  Best regards,<br/>
                  <strong>Your Team</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#fbeae3; text-align:center; padding:15px; font-size:12px; color:#777;">
                © 2025 Your Organization. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>',
    'HTML',
    'LIVE_CLASS',
    false,
    '["NAME", "SESSION_TITLE", "ACTION", "LINK", "THEME_COLOR", "ALL_TIMEZONE_TIMES", "DATE", "TIME"]',
    'ACTIVE',
    'system',
    'system'
);

-- ON_LIVE template
INSERT INTO templates (id, type, institute_id, name, subject, content, content_type, template_category, can_delete, dynamic_parameters, status, created_by, updated_by)
VALUES (
    'default-live-class-on-live-email',
    'EMAIL',
    'DEFAULT',
    'Live Class Started Email',
    'Your Live Session has started – Join now!',
    '<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Live Class Invitation</title>
  </head>
  <body style="margin:0; padding:0; background-color:#fdf5f2; font-family: Arial, sans-serif;">
    <table role="presentation" style="width:100%; border-collapse:collapse; background-color:#fdf5f2; padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" style="width:600px; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
            <tr>
              <td style="background:{{THEME_COLOR}}; padding:20px; text-align:center; color:#fff;">
                <h1 style="margin:0; font-size:24px;">📢 Live Class {{ACTION}}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; color:#333;">
                <p style="font-size:16px;">Hi <strong>{{NAME}}</strong>,</p>
                <p style="font-size:16px; line-height:1.6;">
                  We''re excited to invite you to our upcoming <strong>{{SESSION_TITLE}}</strong>, designed to help you learn and grow with us.
                </p>
                <p style="font-size:14px; font-weight:bold; color:#555; margin-bottom:8px;">🕐 Schedule (by Time Zone):</p>
                <table role="presentation" style="margin:0 0 20px 0; width:100%;">
                  <tr>
                    <td style="padding:16px; background:#fff3ec; border:1px solid #ffe0d1; border-radius:8px;">
                      {{ALL_TIMEZONE_TIMES}}
                    </td>
                  </tr>
                </table>
                <div style="text-align:center; margin:30px 0;">
                  <a href="{{LINK}}" target="_blank"
                     style="display:inline-block; padding:12px 24px; background:{{THEME_COLOR}}; color:#fff;
                            font-size:16px; font-weight:bold; text-decoration:none; border-radius:6px;">
                    Join the Live Class
                  </a>
                </div>
                <p style="font-size:15px; line-height:1.6;">
                  We look forward to seeing you there!
                </p>
                <p style="font-size:15px; line-height:1.6; margin-top:20px;">
                  Best regards,<br/>
                  <strong>Your Team</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#fbeae3; text-align:center; padding:15px; font-size:12px; color:#777;">
                © 2025 Your Organization. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>',
    'HTML',
    'LIVE_CLASS',
    false,
    '["NAME", "SESSION_TITLE", "ACTION", "LINK", "THEME_COLOR", "ALL_TIMEZONE_TIMES", "DATE", "TIME"]',
    'ACTIVE',
    'system',
    'system'
);

-- DELETE template
INSERT INTO templates (id, type, institute_id, name, subject, content, content_type, template_category, can_delete, dynamic_parameters, status, created_by, updated_by)
VALUES (
    'default-live-class-delete-email',
    'EMAIL',
    'DEFAULT',
    'Live Class Cancelled Email',
    'Live Class Cancelled - {{SESSION_TITLE}}',
    '<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Live Class Cancellation Notice</title>
  </head>
  <body style="margin:0; padding:0; background-color:#fdf5f2; font-family: Arial, sans-serif;">
    <table role="presentation" style="width:100%; border-collapse:collapse; background-color:#fdf5f2; padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" style="width:600px; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
            <tr>
              <td style="background:{{THEME_COLOR}}; padding:20px; text-align:center; color:#fff;">
                <h1 style="margin:0; font-size:24px;">❌ Live Class Cancelled</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; color:#333;">
                <p style="font-size:16px;">Hi <strong>{{NAME}}</strong>,</p>
                <p style="font-size:16px; line-height:1.6;">
                  We regret to inform you that the live class <strong>{{SESSION_TITLE}}</strong> has been cancelled.
                </p>
                <p style="font-size:14px; font-weight:bold; color:#555; margin-bottom:8px;">🕐 Cancelled Schedule:</p>
                <table role="presentation" style="margin:0 0 20px 0; width:100%;">
                  <tr>
                    <td style="padding:16px; background:#f8d7da; border:1px solid #f5c6cb; border-radius:8px; color:#721c24;">
                      {{ALL_TIMEZONE_TIMES}}
                    </td>
                  </tr>
                </table>
                <p style="font-size:16px; line-height:1.6;">
                  We apologize for any inconvenience this may cause. We will notify you about any rescheduled sessions or alternative arrangements.
                </p>
                <p style="font-size:15px; line-height:1.6;">
                  If you have any questions or concerns, please don''t hesitate to contact us.
                </p>
                <p style="font-size:15px; line-height:1.6; margin-top:20px;">
                  Thank you for your understanding,<br/>
                  <strong>Your Team</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#fbeae3; text-align:center; padding:15px; font-size:12px; color:#777;">
                © 2025 Your Organization. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>',
    'HTML',
    'LIVE_CLASS',
    false,
    '["NAME", "SESSION_TITLE", "THEME_COLOR", "ALL_TIMEZONE_TIMES", "DATE", "TIME"]',
    'ACTIVE',
    'system',
    'system'
);

-- 2. Insert default event configs mapping events to default templates

INSERT INTO notification_event_config (id, event_name, source_type, source_id, template_type, template_id, is_active, created_by)
VALUES
    ('default-live-class-on-create-config', 'LIVE_CLASS_ON_CREATE', 'INSTITUTE', 'DEFAULT', 'EMAIL', 'default-live-class-on-create-email', true, 'system'),
    ('default-live-class-before-live-config', 'LIVE_CLASS_BEFORE_LIVE', 'INSTITUTE', 'DEFAULT', 'EMAIL', 'default-live-class-before-live-email', true, 'system'),
    ('default-live-class-on-live-config', 'LIVE_CLASS_ON_LIVE', 'INSTITUTE', 'DEFAULT', 'EMAIL', 'default-live-class-on-live-email', true, 'system'),
    ('default-live-class-delete-config', 'LIVE_CLASS_DELETE', 'INSTITUTE', 'DEFAULT', 'EMAIL', 'default-live-class-delete-email', true, 'system');

-- 3. Institute-specific templates for Shiksha Nation (35675130-7c65-41d6-a869-0811d2e1753e)
--    These use the same HTML as defaults. Edit the content/subject below to customize.

INSERT INTO templates (id, type, institute_id, name, subject, content, content_type, template_category, can_delete, dynamic_parameters, status, created_by, updated_by)
VALUES
('sn-live-class-on-create-email', 'EMAIL', '35675130-7c65-41d6-a869-0811d2e1753e', 'Live Class Created Email',
 'New Live Class Created - {{SESSION_TITLE}}',
 '<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Live Class Invitation</title>
  </head>
  <body style="margin:0; padding:0; background-color:#fdf5f2; font-family: Arial, sans-serif;">
    <table role="presentation" style="width:100%; border-collapse:collapse; background-color:#fdf5f2; padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" style="width:600px; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
            <tr>
              <td style="background:{{THEME_COLOR}}; padding:20px; text-align:center; color:#fff;">
                <h1 style="margin:0; font-size:24px;">📢 Live Class {{ACTION}}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; color:#333;">
                <p style="font-size:16px;">Hi <strong>{{NAME}}</strong>,</p>
                <p style="font-size:16px; line-height:1.6;">
                  We''re excited to invite you to our upcoming <strong>{{SESSION_TITLE}}</strong>, designed to help you learn and grow with us.
                </p>
                <p style="font-size:14px; font-weight:bold; color:#555; margin-bottom:8px;">🕐 Schedule (by Time Zone):</p>
                <table role="presentation" style="margin:0 0 20px 0; width:100%;">
                  <tr>
                    <td style="padding:16px; background:#fff3ec; border:1px solid #ffe0d1; border-radius:8px;">
                      {{ALL_TIMEZONE_TIMES}}
                    </td>
                  </tr>
                </table>
                <div style="text-align:center; margin:30px 0;">
                  <a href="{{LINK}}" target="_blank"
                     style="display:inline-block; padding:12px 24px; background:{{THEME_COLOR}}; color:#fff;
                            font-size:16px; font-weight:bold; text-decoration:none; border-radius:6px;">
                    Join the Live Class
                  </a>
                </div>
                <p style="font-size:15px; line-height:1.6;">We look forward to seeing you there!</p>
                <p style="font-size:15px; line-height:1.6; margin-top:20px;">
                  Best regards,<br/><strong>Your Team</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#fbeae3; text-align:center; padding:15px; font-size:12px; color:#777;">
                © 2025 Your Organization. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>',
 'HTML', 'LIVE_CLASS', true,
 '["NAME", "SESSION_TITLE", "ACTION", "LINK", "THEME_COLOR", "ALL_TIMEZONE_TIMES", "DATE", "TIME"]',
 'ACTIVE', 'system', 'system'),

('sn-live-class-before-live-email', 'EMAIL', '35675130-7c65-41d6-a869-0811d2e1753e', 'Live Class Starting Soon Email',
 'Get Ready! Your session begins shortly.',
 '<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Live Class Invitation</title>
  </head>
  <body style="margin:0; padding:0; background-color:#fdf5f2; font-family: Arial, sans-serif;">
    <table role="presentation" style="width:100%; border-collapse:collapse; background-color:#fdf5f2; padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" style="width:600px; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
            <tr>
              <td style="background:{{THEME_COLOR}}; padding:20px; text-align:center; color:#fff;">
                <h1 style="margin:0; font-size:24px;">📢 Live Class {{ACTION}}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; color:#333;">
                <p style="font-size:16px;">Hi <strong>{{NAME}}</strong>,</p>
                <p style="font-size:16px; line-height:1.6;">
                  We''re excited to invite you to our upcoming <strong>{{SESSION_TITLE}}</strong>, designed to help you learn and grow with us.
                </p>
                <p style="font-size:14px; font-weight:bold; color:#555; margin-bottom:8px;">🕐 Schedule (by Time Zone):</p>
                <table role="presentation" style="margin:0 0 20px 0; width:100%;">
                  <tr>
                    <td style="padding:16px; background:#fff3ec; border:1px solid #ffe0d1; border-radius:8px;">
                      {{ALL_TIMEZONE_TIMES}}
                    </td>
                  </tr>
                </table>
                <div style="text-align:center; margin:30px 0;">
                  <a href="{{LINK}}" target="_blank"
                     style="display:inline-block; padding:12px 24px; background:{{THEME_COLOR}}; color:#fff;
                            font-size:16px; font-weight:bold; text-decoration:none; border-radius:6px;">
                    Join the Live Class
                  </a>
                </div>
                <p style="font-size:15px; line-height:1.6;">We look forward to seeing you there!</p>
                <p style="font-size:15px; line-height:1.6; margin-top:20px;">
                  Best regards,<br/><strong>Your Team</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#fbeae3; text-align:center; padding:15px; font-size:12px; color:#777;">
                © 2025 Your Organization. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>',
 'HTML', 'LIVE_CLASS', true,
 '["NAME", "SESSION_TITLE", "ACTION", "LINK", "THEME_COLOR", "ALL_TIMEZONE_TIMES", "DATE", "TIME"]',
 'ACTIVE', 'system', 'system'),

('sn-live-class-on-live-email', 'EMAIL', '35675130-7c65-41d6-a869-0811d2e1753e', 'Live Class Started Email',
 'Your Live Session has started – Join now!',
 '<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Live Class Invitation</title>
  </head>
  <body style="margin:0; padding:0; background-color:#fdf5f2; font-family: Arial, sans-serif;">
    <table role="presentation" style="width:100%; border-collapse:collapse; background-color:#fdf5f2; padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" style="width:600px; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
            <tr>
              <td style="background:{{THEME_COLOR}}; padding:20px; text-align:center; color:#fff;">
                <h1 style="margin:0; font-size:24px;">📢 Live Class {{ACTION}}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; color:#333;">
                <p style="font-size:16px;">Hi <strong>{{NAME}}</strong>,</p>
                <p style="font-size:16px; line-height:1.6;">
                  We''re excited to invite you to our upcoming <strong>{{SESSION_TITLE}}</strong>, designed to help you learn and grow with us.
                </p>
                <p style="font-size:14px; font-weight:bold; color:#555; margin-bottom:8px;">🕐 Schedule (by Time Zone):</p>
                <table role="presentation" style="margin:0 0 20px 0; width:100%;">
                  <tr>
                    <td style="padding:16px; background:#fff3ec; border:1px solid #ffe0d1; border-radius:8px;">
                      {{ALL_TIMEZONE_TIMES}}
                    </td>
                  </tr>
                </table>
                <div style="text-align:center; margin:30px 0;">
                  <a href="{{LINK}}" target="_blank"
                     style="display:inline-block; padding:12px 24px; background:{{THEME_COLOR}}; color:#fff;
                            font-size:16px; font-weight:bold; text-decoration:none; border-radius:6px;">
                    Join the Live Class
                  </a>
                </div>
                <p style="font-size:15px; line-height:1.6;">We look forward to seeing you there!</p>
                <p style="font-size:15px; line-height:1.6; margin-top:20px;">
                  Best regards,<br/><strong>Your Team</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#fbeae3; text-align:center; padding:15px; font-size:12px; color:#777;">
                © 2025 Your Organization. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>',
 'HTML', 'LIVE_CLASS', true,
 '["NAME", "SESSION_TITLE", "ACTION", "LINK", "THEME_COLOR", "ALL_TIMEZONE_TIMES", "DATE", "TIME"]',
 'ACTIVE', 'system', 'system'),

('sn-live-class-delete-email', 'EMAIL', '35675130-7c65-41d6-a869-0811d2e1753e', 'Live Class Cancelled Email',
 'Live Class Cancelled - {{SESSION_TITLE}}',
 '<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Live Class Cancellation Notice</title>
  </head>
  <body style="margin:0; padding:0; background-color:#fdf5f2; font-family: Arial, sans-serif;">
    <table role="presentation" style="width:100%; border-collapse:collapse; background-color:#fdf5f2; padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" style="width:600px; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
            <tr>
              <td style="background:{{THEME_COLOR}}; padding:20px; text-align:center; color:#fff;">
                <h1 style="margin:0; font-size:24px;">❌ Live Class Cancelled</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; color:#333;">
                <p style="font-size:16px;">Hi <strong>{{NAME}}</strong>,</p>
                <p style="font-size:16px; line-height:1.6;">
                  We regret to inform you that the live class <strong>{{SESSION_TITLE}}</strong> has been cancelled.
                </p>
                <p style="font-size:14px; font-weight:bold; color:#555; margin-bottom:8px;">🕐 Cancelled Schedule:</p>
                <table role="presentation" style="margin:0 0 20px 0; width:100%;">
                  <tr>
                    <td style="padding:16px; background:#f8d7da; border:1px solid #f5c6cb; border-radius:8px; color:#721c24;">
                      {{ALL_TIMEZONE_TIMES}}
                    </td>
                  </tr>
                </table>
                <p style="font-size:16px; line-height:1.6;">
                  We apologize for any inconvenience this may cause. We will notify you about any rescheduled sessions or alternative arrangements.
                </p>
                <p style="font-size:15px; line-height:1.6;">
                  If you have any questions or concerns, please don''t hesitate to contact us.
                </p>
                <p style="font-size:15px; line-height:1.6; margin-top:20px;">
                  Thank you for your understanding,<br/><strong>Your Team</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#fbeae3; text-align:center; padding:15px; font-size:12px; color:#777;">
                © 2025 Your Organization. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>',
 'HTML', 'LIVE_CLASS', true,
 '["NAME", "SESSION_TITLE", "THEME_COLOR", "ALL_TIMEZONE_TIMES", "DATE", "TIME"]',
 'ACTIVE', 'system', 'system');

-- 4. Map events to Shiksha Nation's institute-specific templates

INSERT INTO notification_event_config (id, event_name, source_type, source_id, template_type, template_id, is_active, created_by)
VALUES
    ('sn-live-class-on-create-config', 'LIVE_CLASS_ON_CREATE', 'INSTITUTE', '35675130-7c65-41d6-a869-0811d2e1753e', 'EMAIL', 'sn-live-class-on-create-email', true, 'system'),
    ('sn-live-class-before-live-config', 'LIVE_CLASS_BEFORE_LIVE', 'INSTITUTE', '35675130-7c65-41d6-a869-0811d2e1753e', 'EMAIL', 'sn-live-class-before-live-email', true, 'system'),
    ('sn-live-class-on-live-config', 'LIVE_CLASS_ON_LIVE', 'INSTITUTE', '35675130-7c65-41d6-a869-0811d2e1753e', 'EMAIL', 'sn-live-class-on-live-email', true, 'system'),
    ('sn-live-class-delete-config', 'LIVE_CLASS_DELETE', 'INSTITUTE', '35675130-7c65-41d6-a869-0811d2e1753e', 'EMAIL', 'sn-live-class-delete-email', true, 'system');
