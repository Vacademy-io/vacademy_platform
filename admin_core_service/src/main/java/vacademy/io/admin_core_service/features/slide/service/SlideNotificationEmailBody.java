package vacademy.io.admin_core_service.features.slide.service;

public class SlideNotificationEmailBody {

    public static final String NEW_SLIDE_EMAIL_TEMPLATE = """
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f8f8f8;
                        margin: 0;
                        padding: 0;
                    }
                    .container {
                        max-width: 600px;
                        background: #ffffff;
                        margin: 20px auto;
                        padding: 20px;
                        border-radius: 8px;
                        box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
                        text-align: center;
                    }
                    .header {
                        background: #ED7424;
                        color: #ffffff;
                        padding: 15px;
                        font-size: 22px;
                        font-weight: bold;
                        border-radius: 8px 8px 0 0;
                    }
                    .content {
                        margin: 20px 0;
                        font-size: 16px;
                        color: #333;
                        line-height: 1.6;
                    }
                    .button {
                        display: inline-block;
                        padding: 12px 20px;
                        background: #ED7424;
                        color: #ffffff;
                        text-decoration: none;
                        font-size: 16px;
                        border-radius: 5px;
                        font-weight: bold;
                        margin-top: 10px;
                    }
                    .footer {
                        margin-top: 20px;
                        font-size: 14px;
                        color: #777;
                    }
                    .highlight {
                        color: #ED7424;
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">📚 New Study Material Added!</div>
                    <div class="content">
                        <p>Dear <span class="highlight">{{STUDENT_NAME}}</span>,</p>
                        <p>We are excited to inform you that new <strong>slides/study material</strong> have been added to:</p>
                        <p class="highlight">"<strong>{{CHAPTER_NAME}}</strong>"</p>
                        <p>Enhance your knowledge and stay ahead in your learning journey.</p>
                        <a href="{{MATERIAL_LINK}}" class="button">View Material</a>
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
