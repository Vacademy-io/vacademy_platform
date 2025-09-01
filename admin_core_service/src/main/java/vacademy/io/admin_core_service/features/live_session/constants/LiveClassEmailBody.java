package vacademy.io.admin_core_service.features.live_session.constants;

public class LiveClassEmailBody {

    public static String Live_Class_Email_Body="""
            <!DOCTYPE html>
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
                          <td style="background:#ff6f3c; padding:20px; text-align:center; color:#fff;">
                            <h1 style="margin:0; font-size:24px;">📢 Live Class Invitation</h1>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:30px; color:#333;">
                            <p style="font-size:16px;">Hi <strong>{{NAME}}</strong>,</p>
                            
                            <p style="font-size:16px; line-height:1.6;">
                              We're excited to invite you to our upcoming <strong>{{SESSION_TITLE}}</strong>, designed to help you learn and grow with us. 
                            </p>
                            <table role="presentation" style="margin:20px 0; width:100%;">
                                          <tr>
                                            <td style="padding:10px; background:#fff3ec; border:1px solid #ffe0d1; border-radius:6px;">
                                              <p style="margin:0; font-size:15px;"><strong>📅 Date:</strong> {{DATE}}</p>
                                              <p style="margin:5px 0 0 0; font-size:15px;"><strong>⏰ Time:</strong> {{TIME}}</p>
                                            </td>
                                          </tr>
                                        </table>

                            <p style="font-size:16px; line-height:1.6;">
                              Key takeaways from this session:
                            </p>

                            <div style="text-align:center; margin:30px 0;">
                              <a href="{{LINK}}" target="_blank" 
                                 style="display:inline-block; padding:12px 24px; background:#ff6f3c; color:#fff; 
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
            </html>
            """;
}
