package vacademy.io.admin_core_service.features.certificate.notification;

public class CertificateIssuedEmailBody {

    // Lightweight HTML email shown to learners when a certificate is issued.
    // Placeholders are interpolated server-side before send so the unified
    // notification service does not need a per-recipient variable map.
    public static final String CERTIFICATE_ISSUED_EMAIL_TEMPLATE = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8" />
                <style>
                    body { font-family: Arial, sans-serif; background:#f8f8f8; margin:0; padding:0; color:#333; }
                    .container { max-width:600px; background:#ffffff; margin:20px auto; padding:30px;
                                 border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.08); }
                    h1 { color:#1f3b64; margin-top:0; }
                    .cta { display:inline-block; padding:12px 24px; margin-top:16px;
                           background:#2d89e4; color:#ffffff !important; text-decoration:none;
                           border-radius:4px; font-weight:600; }
                    .meta { color:#666; font-size:13px; margin-top:24px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Congratulations, {{STUDENT_NAME}}!</h1>
                    <p>You have successfully completed <strong>{{COURSE_NAME}}</strong> at {{INSTITUTE_NAME}}.</p>
                    <p>Your certificate of achievement is attached to this email and also available below.</p>
                    <p>
                        <a class="cta" href="{{CERTIFICATE_URL}}">View Certificate</a>
                    </p>
                    <p class="meta">
                        Certificate ID: <code>{{CERTIFICATE_ID}}</code><br/>
                        Date of completion: {{DATE_OF_COMPLETION}}
                    </p>
                </div>
            </body>
            </html>
            """;
}
