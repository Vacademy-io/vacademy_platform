package vacademy.io.notification_service.service;

import jakarta.activation.DataHandler;
import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeBodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import jakarta.mail.util.ByteArrayDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.sql.DataSource;
import java.util.Properties;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.ses.sender.email}")
    private String from;

    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);

    @Autowired
    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }
    private final EmailDispatcher emailDispatcher = EmailDispatcher.getInstance();
    public void sendEmail(String to, String subject, String text) {
        try {
            emailDispatcher.sendEmail(() -> {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(to);
                message.setFrom(from);
                message.setSubject(subject);
                message.setText(text);
                mailSender.send(message);
            });
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            e.printStackTrace();
            throw new RuntimeException(e);
        }
    }

    public void sendEmailOtp(String to, String subject, String service, String name, String otp) {
        try {
            // Ensure subject has a valid value
            final String emailSubject = StringUtils.hasText(subject) ? subject : "This is a very important email";

            // Create the email body using the provided information
            final String emailBody = createEmailBody(service, name, otp);

            // Send the email asynchronously using the emailDispatcher
            emailDispatcher.sendEmail(() -> {
                try {
                    // Prepare the email session and message
                    Session session = Session.getDefaultInstance(new Properties(), null);
                    MimeMessage message = new MimeMessage(session);

                    // Set the recipient, sender, and subject
                    message.setRecipient(Message.RecipientType.TO, new InternetAddress(to));
                    message.setFrom(new InternetAddress(from));
                    message.setSubject(emailSubject);

                    // Attach the HTML body
                    MimeMultipart multipart = new MimeMultipart();
                    MimeBodyPart htmlPart = new MimeBodyPart();
                    htmlPart.setContent(emailBody, "text/html; charset=utf-8");
                    multipart.addBodyPart(htmlPart);
                    message.setContent(multipart);

                    // Send the email
                    mailSender.send(message);

                } catch (Exception e) {
                    // Log the exception and rethrow as a RuntimeException
                    throw new RuntimeException("Failed to send OTP email", e);
                }
            });
        } catch (InterruptedException e) {
            // Handle thread interruption and rethrow exception
            Thread.currentThread().interrupt();
            throw new RuntimeException("Failed to send OTP email due to rate limiting", e);
        } catch (Exception e) {
            // Catch any other exceptions that might occur during email sending process
            throw new RuntimeException("An error occurred while preparing the OTP email", e);
        }
    }


    // Method to create the email body
    private String createEmailBody(String service, String name, String otp) {
        return """
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
    }


    public void sendHtmlEmail(String to, String subject, String service, String body) {
        try {
            // Log the start of email preparation
            logger.info("Preparing to send email to: {} with subject: {}", to, subject);

            // Set default subject if none is provided
            final String emailSubject = StringUtils.hasText(subject) ? subject : "This is a very important email";
            final String emailBody = body; // The body is already passed, so just ensure it's final if needed

            // Log the email body (excluding sensitive info like personal data)
            logger.debug("Email body content: {}", emailBody);

            // Send the email asynchronously using the emailDispatcher
            emailDispatcher.sendEmail(() -> {
                try {
                    // Prepare the email session and message
                    logger.info("Setting up email session and message...");
                    Session session = Session.getDefaultInstance(new Properties(), null);
                    MimeMessage message = new MimeMessage(session);

                    // Set the recipient, sender, and subject
                    message.setRecipient(Message.RecipientType.TO, new InternetAddress(to));
                    message.setFrom(new InternetAddress(from));
                    message.setSubject(emailSubject);

                    // Attach the HTML body
                    MimeMultipart multipart = new MimeMultipart();
                    MimeBodyPart htmlPart = new MimeBodyPart();
                    htmlPart.setContent(emailBody, "text/html; charset=utf-8");
                    multipart.addBodyPart(htmlPart);
                    message.setContent(multipart);

                    // Log before sending the email
                    logger.info("Sending email to: {}", to);
                    mailSender.send(message);

                    // Log successful email sending
                    logger.info("Email successfully sent to: {}", to);

                } catch (MessagingException e) {
                    e.printStackTrace();
                    // Log the error and rethrow as RuntimeException
                    logger.error("Error while preparing or sending the email", e);
                    throw new RuntimeException("Failed to send HTML email", e);
                }
            });

        } catch (InterruptedException e) {
            // Handle thread interruption
            e.printStackTrace();
            Thread.currentThread().interrupt();
            logger.error("Email sending interrupted due to rate limiting", e);
            throw new RuntimeException("Failed to send HTML email due to rate limiting", e);
        } catch (Exception e) {
            // Log and handle any other exceptions
            e.printStackTrace();
            logger.error("An error occurred while preparing the HTML email", e);
            throw new RuntimeException("An error occurred while preparing the HTML email", e);
        }
    }

    public void sendAttachmentEmail(String to, String subject, String service, String body, byte[] attachment, String attachmentName) {
        try {
            logger.info("Preparing to send email to: {} with subject: {}", to, subject);

            final String emailSubject = (subject != null && !subject.isEmpty()) ? subject : "This is a very important email";
            final String emailBody = body;

            emailDispatcher.sendEmail(() -> {
                try {
                    logger.info("Setting up email session and message...");
                    Session session = Session.getDefaultInstance(new Properties(), null);
                    MimeMessage message = new MimeMessage(session);

                    message.setRecipient(Message.RecipientType.TO, new InternetAddress(to));
                    message.setFrom(new InternetAddress(from));
                    message.setSubject(emailSubject);

                    MimeMultipart multipart = new MimeMultipart();

                    // Add HTML body
                    MimeBodyPart htmlPart = new MimeBodyPart();
                    htmlPart.setContent(emailBody, "text/html; charset=utf-8");
                    multipart.addBodyPart(htmlPart);

                    // Add attachment if present
                    if (attachment != null && attachment.length > 0) {
                        MimeBodyPart attachmentPart = new MimeBodyPart();
                        ByteArrayDataSource dataSource = new ByteArrayDataSource(attachment, "application/pdf"); // Change MIME type as needed
                        attachmentPart.setDataHandler(new DataHandler(dataSource));
                        attachmentPart.setFileName(attachmentName != null ? attachmentName : "attachment.pdf");
                        multipart.addBodyPart(attachmentPart);
                    }

                    message.setContent(multipart);

                    logger.info("Sending email to: {}", to);
                    mailSender.send(message);
                    logger.info("Email successfully sent to: {}", to);

                } catch (MessagingException e) {
                    logger.error("Error while preparing or sending the email", e);
                    throw new RuntimeException("Failed to send email with attachment", e);
                }
            });

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logger.error("Email sending interrupted due to rate limiting", e);
            throw new RuntimeException("Failed to send email due to rate limiting", e);
        } catch (Exception e) {
            logger.error("An error occurred while preparing the email", e);
            throw new RuntimeException("An error occurred while preparing the email", e);
        }
    }

}
