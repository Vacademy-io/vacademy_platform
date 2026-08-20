/**
 * Sample "Account Credentials" EMAIL template for the LEARNER_CREDENTIALS_SHARED event —
 * the learner-facing counterpart to
 * routes/settings/-components/sample-guardian-credentials-template.ts.
 *
 * This one deliberately DOES carry the password: it is the template behind "Share Credentials",
 * whose whole purpose is handing a learner the login they do not have. Institutes that may not
 * mail plaintext passwords should send a password reset instead (see the Portal Access panel),
 * which mails a link and no credentials.
 *
 * Plain HTML (no MJML) so the admin can keep editing it in the normal template editor.
 */

export interface SampleLearnerCredentialsTemplate {
    name: string;
    subject: string;
    content: string;
    variables: string[];
}

export const LEARNER_CREDENTIALS_VARIABLES = [
    '{{user_full_name}}',
    '{{user_name}}',
    '{{user_password}}',
    '{{institute_name}}',
    '{{theme_color}}',
    '{{portal_url}}',
];

export function buildSampleLearnerCredentialsTemplate(): SampleLearnerCredentialsTemplate {
    return {
        name: 'Learner Account Credentials',
        subject: 'Your login details - {{institute_name}}',
        variables: LEARNER_CREDENTIALS_VARIABLES,
        content: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Your Account Credentials</title>
  </head>
  <body style="margin:0; padding:0; background-color:#fdf5f2; font-family: Arial, sans-serif;">
    <table role="presentation" style="width:100%; border-collapse:collapse; background-color:#fdf5f2; padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" style="width:600px; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
            <tr>
              <td style="background:{{theme_color}}; padding:20px; text-align:center; color:#fff;">
                <h1 style="margin:0; font-size:22px;">Your Account Credentials</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; color:#333;">
                <p style="font-size:16px;">Hi <strong>{{user_full_name}}</strong>,</p>
                <p style="font-size:15px; line-height:1.6;">
                  Here are your login details for <strong>{{institute_name}}</strong>.
                </p>
                <table role="presentation" style="margin:20px 0; width:100%;">
                  <tr>
                    <td style="padding:16px; background:#fff3ec; border:1px solid #ffe0d1; border-radius:8px;">
                      <p style="margin:0 0 8px 0; font-size:14px;"><strong>Username:</strong> {{user_name}}</p>
                      <p style="margin:0; font-size:14px;"><strong>Password:</strong> {{user_password}}</p>
                    </td>
                  </tr>
                </table>
                <p style="text-align:center; margin:28px 0;">
                  <a href="{{portal_url}}/login"
                     style="background:{{theme_color}}; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:6px; font-size:15px; font-weight:bold; display:inline-block;">
                    Sign in
                  </a>
                </p>
                <p style="font-size:13px; line-height:1.6; color:#666;">
                  For your own security, change this password after you sign in.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#faf7f5; padding:16px; text-align:center; color:#888; font-size:12px;">
                {{institute_name}}
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
