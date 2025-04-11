package vacademy.io.auth_service.feature.notification.service;

public class NotificationEmailBody {
    private static String frontendLoginUrl = "https://dash.vacademy.io/login";
    public static String forgetPasswordEmailBody(String service, String name, String username, String password) {
        return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Login Credentials</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #FFF7E1; /* Light yellow background */
            }
            .container {
                max-width: 600px;
                margin: 40px auto;
                padding: 20px;
                background-color: #FFFFFF; /* White background for email content */
                border: 1px solid #ED7424; /* Warm orange border */
                border-radius: 10px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            }
            .header {
                background-color: #ED7424; /* Warm orange header */
                color: #FFF;
                padding: 15px;
                text-align: center;
                border-radius: 10px 10px 0 0;
            }
            .content {
                padding: 20px;
                font-size: 16px;
                color: #333;
            }
            .footer {
                background-color: #ED7424; /* Warm orange footer */
                color: #FFF;
                padding: 10px;
                text-align: center;
                border-radius: 0 0 10px 10px;
            }
            .credentials {
                font-size: 18px;
                font-weight: bold;
                color: #ED7424; /* Warm orange for credentials */
                text-align: center;
                padding: 10px;
                background-color: #FFFAE1; /* Light yellow background */
                border: 2px solid #ED7424; /* Matching border color */
                border-radius: 5px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>Access Your Account</h2>
            </div>
            <div class="content">
                <p>Dear %s,</p>
                <p>These are your credentials to access the app:</p>
                <div class="credentials">
                    <p><strong>Username:</strong> %s</p>
                    <p><strong>Password:</strong> %s</p>
                </div>
                <p>Please use these details to log in and consider changing your password for security.</p>
            </div>
            <div class="footer">
                <p>Best regards, <br> %s</p>
            </div>
        </div>
    </body>
    </html>
    """.formatted(name, username, password, service);
    }
    public static String createWelcomeEmailBody(String service, String name, String username, String password) {
        return """
            <!DOCTYPE html>
            <html>
            <head>
                <title>Welcome to %s</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 0;
                        background-color: #F4F4F4; 
                    }
                    .container {
                        max-width: 600px;
                        margin: 40px auto;
                        padding: 20px;
                        background-color: #FFFFFF;
                        border: 1px solid #FF5722;
                        border-radius: 10px;
                        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                    }
                    .header {
                        background: linear-gradient(45deg, #FF5722, #D84315);
                        color: #FFF;
                        padding: 15px;
                        text-align: center;
                        border-radius: 10px 10px 0 0;
                    }
                    .content {
                        padding: 20px;
                        font-size: 16px;
                        color: #333;
                    }
                    .footer {
                        background: linear-gradient(45deg, #FF5722, #D84315);
                        color: #FFF;
                        padding: 10px;
                        text-align: center;
                        border-radius: 0 0 10px 10px;
                    }
                    .credentials {
                        font-size: 18px;
                        font-weight: bold;
                        color: #D84315;
                        text-align: center;
                        padding: 10px;
                        background-color: #FFCCBC;
                        border: 2px solid #D84315;
                        border-radius: 5px;
                    }
                    .login-button {
                        display: inline-block;
                        margin-top: 20px;
                        padding: 10px 20px;
                        background-color: #FF5722;
                        color: white;
                        text-decoration: none;
                        border-radius: 5px;
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>Welcome to %s</h2>
                    </div>
                    <div class="content">
                        <p>Dear %s,</p>
                        <p>Welcome! We're excited to have you on board. Below are your login credentials for future reference:</p>
                        <div class="credentials">
                            <p><strong>Username:</strong> %s</p>
                            <p><strong>Password:</strong> %s</p>
                        </div>
                        <p>Please keep these details safe and consider updating your password for security.</p>
                        <p>You can log in using the button below:</p>
                        <p style="text-align:center;">
                            <a class="login-button" href="%s" target="_blank">Login to Your Account</a>
                        </p>
                        <p>Enjoy your experience with %s!</p>
                    </div>
                    <div class="footer">
                        <p>Best regards, <br> %s Team</p>
                    </div>
                </div>
            </body>
            </html>
        """.formatted(service, service, name, username, password, frontendLoginUrl, service, service);
    }

    public static String sendUserPasswords(String service) {
        return """
<!DOCTYPE html>
<html>
<head>
    <title>Login Credentials</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #FFF7E1;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            padding: 20px;
            background-color: #FFFFFF;
            border: 1px solid #ED7424;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            background-color: #ED7424;
            color: #FFF;
            padding: 15px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }
        .content {
            padding: 20px;
            font-size: 16px;
            color: #333;
        }
        .footer {
            background-color: #ED7424;
            color: #FFF;
            padding: 10px;
            text-align: center;
            border-radius: 0 0 10px 10px;
        }
        .credentials {
            font-size: 18px;
            font-weight: bold;
            color: #ED7424;
            text-align: center;
            padding: 10px;
            background-color: #FFFAE1;
            border: 2px solid #ED7424;
            border-radius: 5px;
        }
        .login-button {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 20px;
            background-color: #ED7424;
            color: #FFF;
            text-decoration: none;
            font-weight: bold;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Access Your Account</h2>
        </div>
        <div class="content">
            <p>Dear User,</p>
            <p>These are your credentials to access the app:</p>
            <div class="credentials">
                <p><strong>Username:</strong> {{username}}</p>
                <p><strong>Password:</strong> {{password}}</p>
            </div>
            <p>Please use these details to log in and consider changing your password for security.</p>
            <div style="text-align: center;">
                <a href="https://learner.vacademy.io/login" class="login-button">Login Now</a>
            </div>
        </div>
        <div class="footer">
            <p>Best regards, <br> %s</p>
        </div>
    </div>
</body>
</html>
""".formatted(service);
    }

}
