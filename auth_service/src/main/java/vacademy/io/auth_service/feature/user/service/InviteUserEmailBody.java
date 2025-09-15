package vacademy.io.auth_service.feature.user.service;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;

public class InviteUserEmailBody {

    @Value("${teacher.portal.client.url}:https://dash.vacademy.io")
    private static String adminPortalClientUrl;

    public static final String ADMIN_LOGIN_URL = adminPortalClientUrl + "/login";

    public static String createInviteUserEmail(String name, String username, String password, List<String> roles) {
        String rolesFormatted = String.join(", ", roles);

        return """
                <!DOCTYPE html>
                <html>
                <head>
                    <title>You're Invited!</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            background-color: #FAF3E0;
                            padding: 20px;
                        }
                        .container {
                            max-width: 500px;
                            margin: auto;
                            background: #FFFFFF;
                            padding: 20px;
                            border-radius: 8px;
                            box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.1);
                            text-align: center;
                        }
                        .header {
                            font-size: 18px;
                            font-weight: bold;
                            color: #333;
                            margin-bottom: 10px;
                        }
                        .content {
                            font-size: 14px;
                            color: #555;
                        }
                        .credentials {
                            margin-top: 10px;
                            padding: 10px;
                        }
                        .credentials p {
                            margin: 5px 0;
                        }
                        .button {
                            display: inline-block;
                            margin-top: 15px;
                            padding: 10px 15px;
                            background-color: #F58220;
                            color: #ffffff;
                            text-decoration: none;
                            border-radius: 5px;
                            font-size: 14px;
                        }
                        .footer {
                            margin-top: 20px;
                            font-size: 12px;
                            color: #777;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>You're Invited!</h2>
                        <p>Hello %s,</p>
                        <p>You have been invited to join our platform.</p>
                            
                        <div class="credentials">
                            <p><strong>Username:</strong> %s</p>
                            <p><strong>Password:</strong> %s</p>
                            <p><strong>Roles:</strong> %s</p>
                        </div>
                            
                        <p>To accept this invitation, please log in using the button below:</p>
                            
                        <a href="%s" class="button">Accept Invitation</a>
                            
                        <p class="footer">Regards,<br>The Vacademy Team</p>
                    </div>
                </body>
                </html>
                """.formatted(name, username, password, rolesFormatted, ADMIN_LOGIN_URL);
    }

    public static String createReminderEmail(String name, String username, String password, List<String> roles) {
        String rolesFormatted = String.join(", ", roles);

        return """
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Reminder: You're Invited!</title>
                    <style>
                        body {
                            font-family: 'Arial', sans-serif;
                            background: linear-gradient(to right, #f9f9f9, #eceff1);
                            padding: 40px 0;
                        }
                        .container {
                            max-width: 550px;
                            margin: auto;
                            background: #ffffff;
                            padding: 30px;
                            border-radius: 10px;
                            box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1);
                            text-align: center;
                        }
                        .header {
                            font-size: 22px;
                            font-weight: bold;
                            color: #333;
                            padding: 15px;
                            background: #ff9800;
                            color: white;
                            border-radius: 10px 10px 0 0;
                        }
                        .content {
                            font-size: 16px;
                            color: #555;
                            padding: 20px;
                            line-height: 1.6;
                        }
                        .credentials {
                            margin: 20px 0;
                            padding: 15px;
                            background: #f1f8ff;
                            border-radius: 8px;
                            text-align: left;
                        }
                        .credentials p {
                            margin: 5px 0;
                            font-size: 15px;
                            color: #444;
                        }
                        .button {
                            display: inline-block;
                            margin-top: 15px;
                            padding: 12px 20px;
                            background-color: #ff9800;
                            color: #ffffff;
                            text-decoration: none;
                            border-radius: 6px;
                            font-size: 16px;
                            font-weight: bold;
                            transition: background 0.3s;
                        }
                        .button:hover {
                            background-color: #e68900;
                        }
                        .footer {
                            margin-top: 20px;
                            font-size: 13px;
                            color: #777;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            Reminder: You're Invited!
                        </div>
                        <div class="content">
                            <p>Hello <strong>%s</strong>,</p>
                            <p>This is a reminder that you have been invited to join our platform. Below are your account details:</p>
                            <div class="credentials">
                                <p><strong>Username:</strong> %s</p>
                                <p><strong>Password:</strong> %s</p>
                                <p><strong>Roles:</strong> %s</p>
                            </div>
                            <p>Please accept your invitation by clicking below:</p>
                            <a class="button" href="%s">Accept Invitation</a>
                        </div>
                        <div class="footer">
                            Regards, <br> The Vacademy Team
                        </div>
                    </div>
                </body>
                </html>
                """.formatted(name, username, password, rolesFormatted, ADMIN_LOGIN_URL);
    }
}
