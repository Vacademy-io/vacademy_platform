/**
 * Sample "Guardian Account Credentials" EMAIL template — mirrors the
 * "Generate sample" pattern from Invoice Settings
 * (routes/settings/-components/Invoice/sample-invoice-templates.ts), but for
 * the GUARDIAN_ACCOUNT_CREATED notification. Plain HTML (no MJML) — the
 * admin can still edit the raw content afterward via the template editor.
 */

export interface SampleGuardianTemplate {
    name: string;
    subject: string;
    content: string;
    variables: string[];
}

export const GUARDIAN_CREDENTIALS_VARIABLES = [
    '{{user_full_name}}',
    '{{student_name}}',
    '{{guardian_username}}',
    '{{guardian_password}}',
    '{{institute_name}}',
    '{{theme_color}}',
    '{{portal_url}}',
];

export function buildSampleGuardianCredentialsTemplate(): SampleGuardianTemplate {
    return {
        name: 'Guardian Account Credentials',
        subject: 'Guardian Account Credentials - {{institute_name}}',
        variables: GUARDIAN_CREDENTIALS_VARIABLES,
        content: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Guardian Account Credentials</title>
  </head>
  <body style="margin:0; padding:0; background-color:#fdf5f2; font-family: Arial, sans-serif;">
    <table role="presentation" style="width:100%; border-collapse:collapse; background-color:#fdf5f2; padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" style="width:600px; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
            <tr>
              <td style="background:{{theme_color}}; padding:20px; text-align:center; color:#fff;">
                <h1 style="margin:0; font-size:22px;">Guardian Account Created</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; color:#333;">
                <p style="font-size:16px;">Hi <strong>{{user_full_name}}</strong>,</p>
                <p style="font-size:15px; line-height:1.6;">
                  A guardian account for <strong>{{student_name}}</strong> has been created on
                  <strong>{{institute_name}}</strong>. You can use the credentials below to sign in.
                </p>
                <table role="presentation" style="margin:20px 0; width:100%;">
                  <tr>
                    <td style="padding:16px; background:#fff3ec; border:1px solid #ffe0d1; border-radius:8px;">
                      <p style="margin:0 0 8px 0; font-size:14px;"><strong>Username:</strong> {{guardian_username}}</p>
                      <p style="margin:0; font-size:14px;"><strong>Password:</strong> {{guardian_password}}</p>
                    </td>
                  </tr>
                </table>
                <div style="text-align:center; margin:30px 0;">
                  <a href="{{portal_url}}" target="_blank"
                     style="display:inline-block; padding:12px 24px; background:{{theme_color}}; color:#fff;
                            font-size:16px; font-weight:bold; text-decoration:none; border-radius:6px;">
                    Log In
                  </a>
                </div>
                <p style="font-size:13px; color:#777; line-height:1.6;">
                  For security, we recommend changing this password after your first login.
                </p>
                <p style="font-size:15px; line-height:1.6; margin-top:20px;">
                  Best regards,<br/>
                  <strong>{{institute_name}}</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#fbeae3; text-align:center; padding:15px; font-size:12px; color:#777;">
                &copy; {{institute_name}}. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    };
}
