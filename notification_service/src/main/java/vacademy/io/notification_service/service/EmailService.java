package vacademy.io.notification_service.service;

import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeBodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Properties;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.ses.sender.email}")
    private String from;

    @Autowired
    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendEmail(String to, String subject, String text) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setFrom(from);
        message.setSubject(subject);
        message.setText(text);
        mailSender.send(message);
    }

    public void sendEmailOtp(String to, String subject, String service, String name, String otp) throws MessagingException {

        // Default subject if not provided
        subject = StringUtils.hasText(subject) ? subject : "This is a very important email";

        // HTML body with #ED7424 (warm orange) color theme
        String body = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>Confirm Email</title>
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
                    .otp {
                        font-size: 22px;
                        font-weight: bold;
                        color: #ED7424; /* Warm orange for OTP */
                        text-align: center;
                        padding: 10px;
                        background-color: #FFFAE1; /* Light yellow background for OTP */
                        border: 2px solid #ED7424; /* Border matching the header/footer color */
                        border-radius: 5px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>Confirm Your Email Address</h2>
                    </div>
                    <div class="content">
                        <p>Dear %s,</p>
                        <p>We are excited to confirm your email address. Your OTP is:</p>
                        <div class="otp">%s</div>
                        <p>Please enter this OTP on our app to complete the verification process.</p>
                    </div>
                    <div class="footer">
                        <p>Best regards, <br> %s</p>
                    </div>
                </div>
            </body>
            </html>
            """.formatted(name, otp, service);

        // Prepare and send the email
        Session session = Session.getDefaultInstance(new Properties(), null);
        MimeMessage message = new MimeMessage(session);
        message.setRecipient(Message.RecipientType.TO, new InternetAddress(to));
        message.setFrom(new InternetAddress(from));
        message.setSubject(subject);

        // Attach HTML content to the email
        MimeMultipart multipart = new MimeMultipart();
        MimeBodyPart htmlPart = new MimeBodyPart();
        htmlPart.setContent(body, "text/html; charset=utf-8");
        multipart.addBodyPart(htmlPart);
        message.setContent(multipart);

        // Send the email using the mail sender
        mailSender.send(message);
    }


    public void sendHtmlEmail(String to, String subject, String service, String body) throws MessagingException {

        subject = StringUtils.hasText(subject) ? subject : "This is very important email";
        Session session = Session.getDefaultInstance(new Properties(), null);
        MimeMessage message = new MimeMessage(session);
        message.setRecipient(Message.RecipientType.TO, new InternetAddress(to));
        message.setFrom(new InternetAddress(from));
        message.setSubject(subject);
        MimeMultipart multipart = new MimeMultipart();
        MimeBodyPart htmlPart = new MimeBodyPart();
        htmlPart.setContent(body, "text/html; charset=utf-8");
        multipart.addBodyPart(htmlPart);
        message.setContent(multipart);
        mailSender.send(message);
    }
}