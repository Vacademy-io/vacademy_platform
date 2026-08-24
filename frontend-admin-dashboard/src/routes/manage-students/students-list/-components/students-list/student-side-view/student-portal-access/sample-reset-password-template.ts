/**
 * Sample "Reset Your Password" EMAIL template — the same "Generate sample" affordance the
 * guardian-credential picker offers (routes/settings/-components/sample-guardian-credentials-template.ts),
 * for the LEARNER_PASSWORD_RESET event.
 *
 * The point of this template is what it does NOT contain: no password. It carries
 * {{reset_password_link}}, a link that opens the learner portal login with the learner's username
 * already filled in and hands off to the update-profile screen, where they choose their own
 * password. An institute that may not put plaintext credentials in an inbox uses this instead of
 * the credentials template.
 *
 * Plain HTML (no MJML) so the admin can keep editing it in the normal template editor afterwards.
 */

export interface SampleResetPasswordTemplate {
    name: string;
    subject: string;
    content: string;
    variables: string[];
}

export const RESET_PASSWORD_VARIABLES = [
    '{{user_full_name}}',
    '{{user_name}}',
    '{{reset_password_link}}',
    '{{institute_name}}',
    '{{theme_color}}',
    '{{portal_url}}',
];

export function buildSampleResetPasswordTemplate(): SampleResetPasswordTemplate {
    return {
        name: 'Reset Your Password',
        subject: 'Reset your password - {{institute_name}}',
        variables: RESET_PASSWORD_VARIABLES,
        content: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Reset Your Password</title>
  </head>
  <body style="margin:0; padding:0; background-color:#fdf5f2; font-family: Arial, sans-serif;">
    <table role="presentation" style="width:100%; border-collapse:collapse; background-color:#fdf5f2; padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" style="width:600px; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
            <tr>
              <td style="background:{{theme_color}}; padding:20px; text-align:center; color:#fff;">
                <h1 style="margin:0; font-size:22px;">Reset Your Password</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; color:#333;">
                <p style="font-size:16px;">Hi <strong>{{user_full_name}}</strong>,</p>
                <p style="font-size:15px; line-height:1.6;">
                  We received a request to reset the password for your
                  <strong>{{institute_name}}</strong> account. Use the button below to choose a
                  new one.
                </p>
                <table role="presentation" style="margin:20px 0; width:100%;">
                  <tr>
                    <td style="padding:16px; background:#fff3ec; border:1px solid #ffe0d1; border-radius:8px;">
                      <p style="margin:0; font-size:14px;"><strong>Username:</strong> {{user_name}}</p>
                    </td>
                  </tr>
                </table>
                <p style="text-align:center; margin:28px 0;">
                  <a href="{{reset_password_link}}"
                     style="background:{{theme_color}}; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:6px; font-size:15px; font-weight:bold; display:inline-block;">
                    Set a new password
                  </a>
                </p>
                <p style="font-size:13px; line-height:1.6; color:#666;">
                  If the button does not work, copy and paste this link into your browser:<br />
                  <a href="{{reset_password_link}}" style="color:{{theme_color}}; word-break:break-all;">{{reset_password_link}}</a>
                </p>
                <p style="font-size:13px; line-height:1.6; color:#666;">
                  If you did not ask for this, you can safely ignore this email — your password
                  stays as it is.
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
