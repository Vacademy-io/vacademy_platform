package vacademy.io.admin_core_service.features.notification_service.utils;

public class ReferralsEmailBody {

    // Email body for the referrer (person who invited)
    public static final String REFERRER_EMAIL_BODY = """
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <title>Referral Reward</title>
          </head>
          <body style="margin:0;padding:0;background-color:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#111;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
              <tr>
                <td align="center">
                  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.08);">

                    <!-- Header -->
                    <tr>
                      <td style="padding:20px 24px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td style="vertical-align:middle;">
                              <img src="{{INSTITUTE_LOGO_URL}}" alt="{{INSTITUTE_NAME}} logo" width="56" height="56" style="display:block;border-radius:6px;object-fit:cover;" />
                            </td>
                            <td style="padding-left:12px;vertical-align:middle;">
                              <div style="font-size:18px;font-weight:700;color:#0b2545;">{{INSTITUTE_NAME}}</div>
                              <div style="font-size:12px;color:#6b7280;">Referral reward</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                      <td style="padding:18px 24px 8px 24px;">
                        <h2 style="margin:0 0 12px 0;font-size:20px;color:#0b2545;">Thank you for your referral 🎉</h2>

                        <p style="margin:0 0 12px 0;font-size:14px;color:#374151;line-height:1.5;">
                          Hi <strong>{{REFERRER_NAME}}</strong>,
                        </p>

                        <p style="margin:0 0 12px 0;font-size:14px;color:#374151;line-height:1.5;">
                          Thanks for referring <strong>{{REFEREE_NAME}}</strong> to <strong>{{INSTITUTE_NAME}}</strong>.
                          As a token of appreciation, we’re giving you access to exclusive content:
                        </p>

                        <!-- Content links -->
                        <ul style="padding-left:18px;margin:0 0 16px 0;font-size:14px;color:#0b2545;">
                          {{CONTENT_LINKS}}
                        </ul>

                        <hr style="border:none;border-top:1px solid #eef2f7;margin:18px 0;" />

                        <p style="margin:0;font-size:13px;color:#6b7280;">
                          We appreciate you being part of {{INSTITUTE_NAME}}’s referral program. Keep sharing and enjoy more rewards!
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
        """;

    // Email body for the referee (newly joined user)
    public static final String REFEREE_EMAIL_BODY = """
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <title>Welcome Reward</title>
          </head>
          <body style="margin:0;padding:0;background-color:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#111;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
              <tr>
                <td align="center">
                  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.08);">

                    <!-- Header -->
                    <tr>
                      <td style="padding:20px 24px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td style="vertical-align:middle;">
                              <img src="{{INSTITUTE_LOGO_URL}}" alt="{{INSTITUTE_NAME}} logo" width="56" height="56" style="display:block;border-radius:6px;object-fit:cover;" />
                            </td>
                            <td style="padding-left:12px;vertical-align:middle;">
                              <div style="font-size:18px;font-weight:700;color:#0b2545;">{{INSTITUTE_NAME}}</div>
                              <div style="font-size:12px;color:#6b7280;">Welcome reward</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                      <td style="padding:18px 24px 8px 24px;">
                        <h2 style="margin:0 0 12px 0;font-size:20px;color:#0b2545;">Welcome to {{INSTITUTE_NAME}} 🎉</h2>

                        <p style="margin:0 0 12px 0;font-size:14px;color:#374151;line-height:1.5;">
                          Hi <strong>{{REFEREE_NAME}}</strong>,
                        </p>

                        <p style="margin:0 0 12px 0;font-size:14px;color:#374151;line-height:1.5;">
                          You’ve been invited by <strong>{{REFERRER_NAME}}</strong> to join <strong>{{INSTITUTE_NAME}}</strong>.
                          To kick things off, here’s some exclusive content prepared just for you:
                        </p>

                        <!-- Content links -->
                        <ul style="padding-left:18px;margin:0 0 16px 0;font-size:14px;color:#0b2545;">
                          {{CONTENT_LINKS}}
                        </ul>

                        <hr style="border:none;border-top:1px solid #eef2f7;margin:18px 0;" />

                        <p style="margin:0;font-size:13px;color:#6b7280;">
                          We’re excited to have you with us. Explore, learn, and enjoy your journey with {{INSTITUTE_NAME}} 🚀
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
        """;
}
