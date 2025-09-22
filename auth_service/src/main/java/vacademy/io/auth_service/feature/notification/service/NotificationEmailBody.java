package vacademy.io.auth_service.feature.notification.service;

public class NotificationEmailBody {
    private static String frontendLoginUrl = "https://dash.vacademy.io/login";
    private static String LEARNER_LOGIN_URL = "https://learner.vacademy.io/login";

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


    public static String createWelcomeEmailBody(
            String service,
            String name,
            String username,
            String password,
            String frontendLoginUrl,
            String themeColor
    ) {
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Welcome to %s</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #fafafa;
                    line-height: 1.6;
                }
                .container {
                    max-width: 640px;
                    margin: 40px auto;
                    padding: 0 20px;
                }
                .card {
                    background: #ffffff;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                    border: 1px solid #eee;
                }
                .header {
                    padding: 32px 40px;
                    border-bottom: 1px solid #F0F0F0;
                }
                .content {
                    padding: 40px;
                    color: #444444;
                }
                .footer {
                    padding: 24px 40px;
                    background-color: #f8f8f8;
                    border-top: 1px solid #F0F0F0;
                    border-radius: 0 0 8px 8px;
                }
                h1 {
                    color: %s; /* Dynamic heading color */
                    font-size: 24px;
                    margin: 0 0 8px 0;
                    font-weight: 600;
                }
                .credentials-box {
                    background: #FDF2E9;
                    border-radius: 6px;
                    padding: 24px;
                    margin: 32px 0;
                }
                .credential-item {
                    margin: 12px 0;
                    font-size: 15px;
                }
                .credential-label {
                    color: %s; /* Dynamic label color */
                    font-weight: 500;
                    display: block;
                    margin-bottom: 4px;
                }
                .login-button {
                    display: inline-block;
                    padding: 12px 32px;
                    background-color: %s; /* Dynamic button color */
                    color: white !important;
                    text-decoration: none;
                    border-radius: 6px;
                    font-weight: 500;
                    transition: background-color 0.2s;
                }
                .login-button:hover {
                    background-color: %s; /* Darker hover */
                }
                .text-muted {
                    color: #666666;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <div class="header">
                        <h1>Welcome to %s</h1>
                        <p class="text-muted">Your account has been successfully created</p>
                    </div>
                    
                    <div class="content">
                        <p>Dear %s,</p>
                        <p>Welcome to %s. Below are your login credentials:</p>
                        
                        <div class="credentials-box">
                            <div class="credential-item">
                                <span class="credential-label">Username</span>
                                %s
                            </div>
                            <div class="credential-item">
                                <span class="credential-label">Password</span>
                                %s
                            </div>
                        </div>
                        
                        <p style="text-align: center; margin: 32px 0;">
                            <a href="%s" class="login-button">Access Your Account</a>
                        </p>
                        
                        <p class="text-muted">Please keep your credentials secure and do not share them with anyone.</p>
                    </div>
                    
                    <div class="footer">
                        <p class="text-muted" style="margin: 0;">
                            Best regards,<br>
                            <strong>%s Team</strong>
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """.formatted(
                service,           // title
                themeColor,        // h1 color
                themeColor,        // label color
                themeColor,        // button color
                darkenWelcomeColor(themeColor), // hover color (optional helper below)
                service, name, service,
                username, password,
                frontendLoginUrl,
                service
        );
    }

    private static String darkenWelcomeColor(String hexColor) {
        try {
            java.awt.Color color = java.awt.Color.decode(hexColor);
            int r = (int)(color.getRed() * 0.85);
            int g = (int)(color.getGreen() * 0.85);
            int b = (int)(color.getBlue() * 0.85);
            return String.format("#%02x%02x%02x", r, g, b);
        } catch (Exception e) {
            return hexColor; // fallback
        }
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
                            <p>Please use these details to log in. </p>
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

    public static String sendUpdatedUserPasswords(String service, String name, String username, String password) {
        return """
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Updated Login Credentials - %s</title>
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
                                <h2>Your Credentials Have Been Updated - %s</h2>
                            </div>
                            <div class="content">
                                <p>Dear %s,</p>
                                <p>We wanted to let you know that your login credentials have been updated. Please find the new credentials below:</p>
                                <div class="credentials">
                                    <p><strong>Username:</strong> %s</p>
                                    <p><strong>Password:</strong> %s</p>
                                </div>
                                <p>We recommend logging in as soon as possible and updating your password for added security.</p>
                                <p style="text-align:center;">
                                    <a class="login-button" href="%s" target="_blank">Login to Your Account</a>
                                </p>
                           
                            </div>
                            <div class="footer">
                                <p>Best regards,<br> %s Team</p>
                            </div>
                        </div>
                    </body>
                    </html>
                """.formatted(service, service, name, username, password, LEARNER_LOGIN_URL, service, service);
    }

    public static String createCredentialsFoundEmailBody(
            String service,
            String name,
            String username,
            String password,
            String frontendLoginUrl,
            String themeColor // <-- NEW PARAMETER
    ) {
        return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Access Your Account - %s</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #fafafa;
                line-height: 1.6;
            }
            .container {
                max-width: 640px;
                margin: 40px auto;
                padding: 0 20px;
            }
            .card {
                background: #ffffff;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                border: 1px solid #eee;
            }
            .header {
                padding: 32px 40px;
                border-bottom: 1px solid #F0F0F0;
            }
            .content {
                padding: 40px;
                color: #444444;
            }
            .footer {
                padding: 24px 40px;
                background-color: #f8f8f8;
                border-top: 1px solid #F0F0F0;
                border-radius: 0 0 8px 8px;
            }
            h1 {
                color: %s; /* Dynamic heading color */
                font-size: 24px;
                margin: 0 0 8px 0;
                font-weight: 600;
            }
            .credentials-box {
                background: #FDF2E9;
                border-radius: 6px;
                padding: 24px;
                margin: 32px 0;
            }
            .credential-item {
                margin: 12px 0;
                font-size: 15px;
            }
            .credential-label {
                color: %s; /* Dynamic label color */
                font-weight: 500;
                display: block;
                margin-bottom: 4px;
            }
            .login-button {
                display: inline-block;
                padding: 12px 32px;
                background-color: %s; /* Dynamic button color */
                color: white !important;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 500;
                transition: background-color 0.2s;
            }
            .login-button:hover {
                background-color: %s; /* Slightly darker hover */
            }
            .text-muted {
                color: #666666;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="header">
                    <h1>Account Found on %s</h1>
                    <p class="text-muted">We've located your credentials</p>
                </div>
                
                <div class="content">
                    <p>Dear %s,</p>
                    <p>We found existing login credentials associated with this email. For your convenience, we've preserved them below so you can continue using %s:</p>
                    
                    <div class="credentials-box">
                        <div class="credential-item">
                            <span class="credential-label">Username</span>
                            %s
                        </div>
                        <div class="credential-item">
                            <span class="credential-label">Password</span>
                            %s
                        </div>
                    </div>
                    
                    <p style="text-align: center; margin: 32px 0;">
                        <a href="%s" class="login-button">Continue to %s</a>
                    </p>
                    
                    <p class="text-muted">If you didn’t request this, please ignore the message or reset your password from the login page.</p>
                </div>
                
                <div class="footer">
                    <p class="text-muted" style="margin: 0;">
                        Best regards,<br>
                        <strong>%s Team</strong>
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """.formatted(
                service,                // <title>
                themeColor,             // h1 color
                themeColor,             // label color
                themeColor,             // button color
                darkenShowCredentialColor(themeColor),// hover color
                service, name, service,
                username, password,
                frontendLoginUrl, service,
                service
        );
    }

    /**
     * Optional helper to darken the hover color slightly.
     * You can skip this if you want to pass a fixed hover color instead.
     */
    private static String darkenShowCredentialColor(String hexOrName) {
        try {
            java.awt.Color color = java.awt.Color.decode(
                    hexOrName.startsWith("#") ? hexOrName :
                            switch (hexOrName.toLowerCase()) {
                                case "purple" -> "#800080";
                                case "blue"   -> "#0000FF";
                                case "red"    -> "#FF0000";
                                case "green"  -> "#008000";
                                default       -> "#333333"; // fallback
                            }
            );
            int r = (int)(color.getRed() * 0.85);
            int g = (int)(color.getGreen() * 0.85);
            int b = (int)(color.getBlue() * 0.85);
            return String.format("#%02x%02x%02x", r, g, b);
        } catch (Exception e) {
            return hexOrName;
        }
    }

}
