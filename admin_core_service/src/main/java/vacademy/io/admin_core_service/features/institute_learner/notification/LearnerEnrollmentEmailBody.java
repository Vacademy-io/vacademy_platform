package vacademy.io.admin_core_service.features.institute_learner.notification;

public class LearnerEnrollmentEmailBody {
    public static final String NEW_CREDENTIALS_EMAIL_TEMPLATE = """
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: 'Arial', sans-serif;
                        background-color: #f8f8f8;
                        margin: 0;
                        padding: 0;
                        color: #333;
                    }
                    .container {
                        max-width: 600px;
                        background: #ffffff;
                        margin: 20px auto;
                        padding: 30px;
                        border-radius: 12px;
                        box-shadow: 0px 6px 12px rgba(0, 0, 0, 0.1);
                        text-align: center;
                    }
                    .header {
                        background: linear-gradient(135deg, #ED7424, #FF8C42);
                        color: #ffffff;
                        padding: 25px;
                        font-size: 26px;
                        font-weight: bold;
                        border-radius: 12px 12px 0 0;
                        margin: -30px -30px 20px -30px;
                    }
                    .content {
                        margin: 20px 0;
                        font-size: 16px;
                        line-height: 1.8;
                        text-align: left;
                    }
                    .content p {
                        margin: 15px 0;
                    }
                    .button {
                        display: inline-block;
                        padding: 14px 28px;
                        background: #ED7424;
                        color: #ffffff;
                        text-decoration: none;
                        font-size: 18px;
                        border-radius: 8px;
                        font-weight: bold;
                        margin: 20px 0;
                        transition: background 0.3s ease;
                    }
                    .button:hover {
                        background: #FF8C42;
                    }
                    .footer {
                        margin-top: 30px;
                        font-size: 14px;
                        color: #777;
                        text-align: center;
                    }
                    .highlight {
                        color: #ED7424;
                        font-weight: bold;
                    }
                    .credentials {
                        background: #f8f8f8;
                        padding: 15px;
                        border-radius: 8px;
                        margin: 20px 0;
                        text-align: left;
                    }
                    .credentials p {
                        margin: 10px 0;
                    }
                    .credentials strong {
                        color: #555;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">🎉 Welcome to {{INSTITUTE_NAME}}!</div>
                    <div class="content">
                        <p>Dear <span class="highlight">{{STUDENT_NAME}}</span>,</p>
                        <p>We are thrilled to welcome you to <strong>{{INSTITUTE_NAME}}</strong>! Your account has been successfully created, and we're excited to have you on board.</p>
                        <p><strong>Here are your login credentials:</strong></p>
                        <div class="credentials">
                            <p><strong>Username:</strong> <span class="highlight">{{USERNAME}}</span></p>
                            <p><strong>Password:</strong> <span class="highlight">{{PASSWORD}}</span></p>
                        </div>
                        <p>Click the button below to log in and get started:</p>
                        <a href="{{LOGIN_URL}}" class="button">Login Now</a>
                        <p>If you have any questions or need assistance, feel free to reach out to us. We're here to help!</p>
                    </div>
                    <div class="footer">
                        <p>Happy Learning! 🚀</p>
                        <p><strong>{{INSTITUTE_NAME}}</strong></p>
                    </div>
                </div>
            </body>
            </html>
            """;
}
