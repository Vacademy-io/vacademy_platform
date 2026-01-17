package vacademy.io.notification_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.notification_service.constants.NotificationConstants;
import vacademy.io.notification_service.features.announcements.service.InstituteAnnouncementSettingsService;
import vacademy.io.notification_service.features.announcements.dto.EmailConfigDTO;
import vacademy.io.notification_service.features.announcements.service.EmailConfigurationService;
import vacademy.io.notification_service.institute.InstituteInfoDTO;
import vacademy.io.notification_service.institute.InstituteInternalService;
import vacademy.io.common.logging.SentryLogger;
import vacademy.io.notification_service.util.EmailDomainBlocklistUtil;

import java.util.AbstractMap;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Properties;
import java.util.Set;

@Service
public class EmailService {

    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);
    private final JavaMailSender mailSender;
    private final EmailDispatcher emailDispatcher;
    @Value("${app.ses.sender.email}")
    private String from;

    @Value("${ses.configuration.set}")
    private String sesConfigurationSet;

    @Value("${aws.sqs.enabled}")
    private boolean awsSqsEnabled;

    private final InstituteInternalService internalService;
    private final EmailConfigurationService emailConfigurationService;
    private final ObjectMapper objectMapper;
    private final InstituteAnnouncementSettingsService instituteAnnouncementSettingsService;

    @Autowired
    public EmailService(JavaMailSender mailSender, InstituteInternalService internalService,
            ObjectMapper objectMapper, EmailDispatcher emailDispatcher,
            InstituteAnnouncementSettingsService instituteAnnouncementSettingsService,
            EmailConfigurationService emailConfigurationService) {
        this.mailSender = mailSender;
        this.internalService = internalService;
        this.objectMapper = objectMapper;
        this.emailDispatcher = emailDispatcher;
        this.instituteAnnouncementSettingsService = instituteAnnouncementSettingsService;
        this.emailConfigurationService = emailConfigurationService;
    }

    private JavaMailSenderImpl createCustomMailSender(JsonNode emailSettings) {
        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
        mailSender.setHost(emailSettings.path(NotificationConstants.HOST).asText());
        mailSender.setPort(emailSettings.path(NotificationConstants.PORT).asInt(2587));
        mailSender.setUsername(emailSettings.path(NotificationConstants.USERNAME).asText());
        mailSender.setPassword(emailSettings.path(NotificationConstants.PASSWORD).asText());

        // Add these properties for TLS
        Properties props = mailSender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true"); // This is the key part
        props.put("mail.debug", "false");

        // Connection timeout settings to prevent [EOF] authentication failures
        props.put("mail.smtp.connectiontimeout", "10000"); // 10 seconds to establish connection
        props.put("mail.smtp.timeout", "10000"); // 10 seconds for read operations
        props.put("mail.smtp.writetimeout", "10000"); // 10 seconds for write operations

        // Prevent using stale connections that cause EOF errors
        props.put("mail.smtp.ssl.checkserveridentity", "true");
        props.put("mail.smtp.starttls.required", "true");

        // Connection pool management - close connections after each send to avoid stale
        // connections
        props.put("mail.smtp.quitwait", "false"); // Don't wait for server response on QUIT command

        mailSender.setJavaMailProperties(props);
        return mailSender;
    }

    /**
     * Get mail sender config with specific email type
     * Falls back to UTILITY_EMAIL if emailType is not provided
     */
    private AbstractMap.SimpleEntry<JavaMailSender, String> getMailSenderConfig(String instituteId, String emailType) {
        JavaMailSender mailSenderToUse = mailSender;
        String fromToUse = from;

        if (StringUtils.hasText(instituteId)) {
            InstituteInfoDTO institute = internalService.getInstituteByInstituteId(instituteId);
            try {
                if (institute != null && institute.getSetting() != null) {
                    JsonNode settings = objectMapper.readTree(institute.getSetting());

                    // Determine which email type to use - default to UTILITY_EMAIL if not specified
                    String emailTypeToUse = StringUtils.hasText(emailType) ? emailType
                            : NotificationConstants.UTILITY_EMAIL;

                    JsonNode emailSettingsData = settings
                            .path(NotificationConstants.SETTING)
                            .path(NotificationConstants.EMAIL_SETTING)
                            .path(NotificationConstants.DATA);

                    JsonNode emailConfig = emailSettingsData.path(emailTypeToUse);

                    if (!emailConfig.isMissingNode()) {
                        logger.info("Found email configuration for type: {} in institute: {}", emailTypeToUse,
                                instituteId);

                        // Check if SMTP credentials are real or dummy placeholders
                        String username = emailConfig.path(NotificationConstants.USERNAME).asText("");
                        String password = emailConfig.path(NotificationConstants.PASSWORD).asText("");

                        boolean isDummyCredentials = isDummySMTPCredentials(username, password);

                        if (isDummyCredentials) {
                            logger.info("Dummy SMTP credentials detected in {}, using default SMTP from environment",
                                    emailTypeToUse);
                            // Use default mail sender from Spring but override 'from' address from JSON
                            mailSenderToUse = mailSender;
                        } else {
                            logger.info("Real SMTP credentials found in {}, using custom SMTP configuration",
                                    emailTypeToUse);
                            // Use custom SMTP configuration from JSON
                            mailSenderToUse = createCustomMailSender(emailConfig);
                        }

                        // Always use the 'from' address from the email type configuration
                        fromToUse = resolveFromAddress(emailConfig, from);
                        logger.info("Using from address: {} from email type: {}", fromToUse, emailTypeToUse);

                    } else {
                        logger.warn("Email type {} not found in settings, trying UTILITY_EMAIL fallback",
                                emailTypeToUse);
                        // Fallback to UTILITY_EMAIL if specified type not found
                        if (!emailTypeToUse.equals(NotificationConstants.UTILITY_EMAIL)) {
                            return getMailSenderConfig(instituteId, NotificationConstants.UTILITY_EMAIL);
                        }
                        logger.info("No custom SMTP settings found, using default SMTP");
                    }
                }
            } catch (Exception e) {
                logger.error("Error parsing institute email settings for instituteId: {}. Using default SMTP.",
                        instituteId, e);
                // Continue with default settings instead of throwing
            }
        } else {
            logger.info("No instituteId provided, using default SMTP");
        }

        return new AbstractMap.SimpleEntry<>(mailSenderToUse, fromToUse);
    }

    /**
     * Legacy method for backward compatibility - uses UTILITY_EMAIL by default
     */
    private AbstractMap.SimpleEntry<JavaMailSender, String> getMailSenderConfig(String instituteId) {
        return getMailSenderConfig(instituteId, null);
    }

    /**
     * Check if SMTP credentials are dummy placeholders
     */
    private boolean isDummySMTPCredentials(String username, String password) {
        if (!StringUtils.hasText(username) || !StringUtils.hasText(password)) {
            return true;
        }

        // List of dummy/placeholder values
        String[] dummyValues = {
                "SMTP_USERNAME", "SMTP_PASSWORD",
                "your_username", "your_password",
                "username", "password",
                "placeholder", "dummy",
                "changeme", "change_me",
                "example", "test"
        };

        for (String dummy : dummyValues) {
            if (username.equalsIgnoreCase(dummy) || password.equalsIgnoreCase(dummy)) {
                logger.debug("Detected dummy credential: username={}, password={}", username, password);
                return true;
            }
        }

        return false;
    }

    private boolean shouldIncludeSesConfigurationHeader(String instituteId) {
        if (!awsSqsEnabled) {
            return false;
        }

        if (!StringUtils.hasText(instituteId)) {
            return true;
        }

        try {
            return instituteAnnouncementSettingsService.isEmailTrackingEnabled(instituteId);
        } catch (Exception e) {
            logger.warn("Failed to resolve email tracking setting for institute {}: {}", instituteId, e.getMessage());
            return true;
        }
    }

    public void sendEmail(String to, String subject, String text, String instituteId) {
        try {
            AbstractMap.SimpleEntry<JavaMailSender, String> config = getMailSenderConfig(instituteId);
            JavaMailSender mailSenderToUse = config.getKey();
            String fromToUse = config.getValue();

            // Use MimeMessage to support SES configuration set header
            MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
            message.setRecipient(Message.RecipientType.TO, new InternetAddress(to));
            message.setFrom(new InternetAddress(fromToUse));
            message.setSubject(subject);
            message.setText(text);

            // Add SES configuration set header for event tracking
            if (shouldIncludeSesConfigurationHeader(instituteId)) {
                message.setHeader("X-SES-CONFIGURATION-SET", sesConfigurationSet);
            }

            mailSenderToUse.send(message);
            logger.info("Email sent successfully to {} using {}", to,
                    StringUtils.hasText(instituteId) ? "custom SMTP" : "default SMTP");

        } catch (Exception e) {
            logger.error("Failed to send email", e);
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Failed to send simple email")
                    .withTag("notification.type", "EMAIL")
                    .withTag("email.type", "SIMPLE")
                    .withTag("recipient.email", to)
                    .withTag("institute.id", instituteId != null ? instituteId : "unknown")
                    .withTag("operation", "sendEmail")
                    .send();
            throw new RuntimeException(e);
        }
    }

    public void sendEmailOtp(String to, String subject, String service, String name, String otp, String instituteId) {
        try {
            AbstractMap.SimpleEntry<JavaMailSender, String> config = getMailSenderConfig(instituteId);
            JavaMailSender mailSenderToUse = config.getKey();
            String fromToUse = config.getValue();
            InstituteInfoDTO instituteInfoDTO = null;

            if (instituteId != null && StringUtils.hasText(instituteId))
                instituteInfoDTO = internalService.getInstituteByInstituteId(instituteId);

            // default vacademy theme
            name = name == null ? "User" : name;
            String instituteTheme = "#ED7424";
            String instituteName = "Vacademy";
            String instituteUrl = "https://dash.vacademy.io";
            if (instituteInfoDTO != null) {

                instituteTheme = instituteInfoDTO.getInstituteThemeCode() != null
                        ? instituteInfoDTO.getInstituteThemeCode()
                        : instituteTheme;
                instituteName = instituteInfoDTO.getInstituteName() != null ? instituteInfoDTO.getInstituteName()
                        : instituteName;
                instituteUrl = instituteInfoDTO.getWebsiteUrl() != null ? instituteInfoDTO.getWebsiteUrl()
                        : instituteUrl;
            }

            final String emailSubject = StringUtils.hasText(subject)
                    ? subject
                    : "Your One-Time Password (OTP) for " + instituteName + " Access | " + otp;

            // Build the HTML body for the OTP email
            final String emailBody = createEmailBody(name, otp, instituteTheme, instituteName, instituteUrl, fromToUse);

            final boolean includeSesHeader = shouldIncludeSesConfigurationHeader(instituteId);

            emailDispatcher.sendEmail(() -> {
                try {
                    Session session = Session.getDefaultInstance(new Properties(), null);
                    MimeMessage message = new MimeMessage(session);

                    message.setRecipient(Message.RecipientType.TO, new InternetAddress(to));
                    message.setFrom(new InternetAddress(fromToUse));
                    message.setSubject(emailSubject);

                    // Add SES configuration set header for event tracking
                    if (includeSesHeader) {
                        message.setHeader("X-SES-CONFIGURATION-SET", sesConfigurationSet);
                    }

                    // Add HTML content
                    MimeMultipart multipart = new MimeMultipart();
                    MimeBodyPart htmlPart = new MimeBodyPart();
                    htmlPart.setContent(emailBody, "text/html; charset=utf-8");
                    multipart.addBodyPart(htmlPart);

                    message.setContent(multipart);

                    logger.info("Sending OTP email to: {}", to);
                    mailSenderToUse.send(message);
                    logger.info("OTP email successfully sent to: {}", to);

                } catch (Exception e) {
                    logger.error("Error while sending OTP email", e);
                    SentryLogger.SentryEventBuilder.error(e)
                            .withMessage("Failed to send OTP email")
                            .withTag("notification.type", "EMAIL")
                            .withTag("email.type", "OTP")
                            .withTag("recipient.email", to)
                            .withTag("institute.id", instituteId != null ? instituteId : "unknown")
                            .withTag("operation", "sendEmailOtp")
                            .send();
                    throw new RuntimeException("Failed to send OTP email", e);
                }
            });

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logger.error("OTP email sending interrupted due to rate limiting", e);
            throw new RuntimeException("Failed to send OTP email due to rate limiting", e);
        } catch (Exception e) {
            logger.error("An error occurred while preparing the OTP email", e);
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Failed to prepare OTP email")
                    .withTag("notification.type", "EMAIL")
                    .withTag("email.type", "OTP")
                    .withTag("recipient.email", to)
                    .withTag("institute.id", instituteId != null ? instituteId : "unknown")
                    .withTag("operation", "prepareEmailOtp")
                    .send();
            throw new RuntimeException("An error occurred while preparing the OTP email", e);
        }
    }

    // Method to create the email body
    // Method to create the email body with placeholders {{service}}, {{name}},
    // {{otp}}
    private String createEmailBody(String name, String otp, String theme, String instituteName, String instituteWebsite,
            String instituteEmail) {
        String template = """
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Confirm Email</title>
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
                            border: 2px solid {{theme}};
                            border-radius: 10px;
                            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                        }
                        .content {
                            padding: 20px;
                            font-size: 16px;
                            color: black;
                            line-height: 1.6;
                        }
                        .otp {
                            font-size: 22px;
                            font-weight: bold;
                            color: white;
                            text-align: center;
                            padding: 10px;
                            background-color: {{theme}};
                            border: 2px solid {{theme}};
                            border-radius: 5px;
                            margin: 15px 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="content">
                            <p>Dear User,</p>
                            <p>Your One-Time Password (OTP) to access <b>{{instituteName}}</b> is:</p>

                            <div class="otp">{{otp}}</div>

                            <p>This OTP is valid for <b>10 minutes</b> and can be used only once.</p>
                            <p>Please do not share this code with anyone for security reasons.</p>

                            <p>If you did not request this code, please ignore this message or
                            contact our support team immediately.</p>

                            <p>Thank you,</p>
                            <p><b>{{instituteName}} Team</b></p>
                            <p>Email: {{instituteEmail}}</p>
                            <p>Web: <a href="{{instituteWebsite}}" target="_blank">{{instituteWebsite}}</a></p>
                        </div>
                    </div>
                </body>
                </html>
                """;

        return template
                .replace("{{name}}", name)
                .replace("{{otp}}", otp)
                .replace("{{theme}}", theme)
                .replace("{{instituteEmail}}", instituteEmail)
                .replace("{{instituteName}}", instituteName)
                .replace("{{instituteWebsite}}", instituteWebsite);
    }

    public void sendHtmlEmail(String to, String subject, String service, String body, String instituteId) {
        sendHtmlEmail(to, subject, service, body, instituteId, null, null, null);
    }

    public void sendHtmlEmail(String to, String subject, String service, String body, String instituteId,
            String customFromEmail, String customFromName) {
        sendHtmlEmail(to, subject, service, body, instituteId, customFromEmail, customFromName, null);
    }

    public void sendHtmlEmail(String to, String subject, String service, String body, String instituteId,
            String customFromEmail, String customFromName, String emailType) {
        try {
            // Skip sending email if the domain is in the blocked list
            if (EmailDomainBlocklistUtil.isEmailDomainBlocked(to)) {
                logger.info("Skipping HTML email for user with blocked email domain: {}", to);
                return;
            }

            AbstractMap.SimpleEntry<JavaMailSender, String> config = getMailSenderConfig(instituteId, emailType);
            final JavaMailSender finalMailSender = config.getKey();
            String fromEmail = config.getValue();

            logger.info("Sending HTML email to: {} using emailType: {} for service: {}", to, emailType, service);

            // Determine final from address - custom email takes highest priority
            final String finalFromEmail;
            if (customFromEmail != null && !customFromEmail.trim().isEmpty()) {
                finalFromEmail = customFromEmail;
                logger.info("Using custom from email: {} for service: {}", customFromEmail, service);
            } else {
                finalFromEmail = fromEmail;
                logger.info("Using from email from config: {} for service: {}", fromEmail, service);
            }

            // Determine final from name
            final String finalFromName = (customFromName != null && !customFromName.trim().isEmpty()) ? customFromName
                    : null;

            String emailSubject = StringUtils.hasText(subject) ? subject : "This is a very important email";

            final boolean includeSesHeader = shouldIncludeSesConfigurationHeader(instituteId);

            emailDispatcher.sendEmail(() -> {
                try {
                    MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
                    message.setRecipient(Message.RecipientType.TO, new InternetAddress(to));

                    // Set from address with optional display name
                    if (finalFromName != null) {
                        message.setFrom(new InternetAddress(finalFromEmail, finalFromName));
                    } else {
                        message.setFrom(new InternetAddress(finalFromEmail));
                    }

                    message.setSubject(emailSubject);

                    // Add SES configuration set header for event tracking
                    if (includeSesHeader) {
                        message.setHeader("X-SES-CONFIGURATION-SET", sesConfigurationSet);
                    }

                    MimeMultipart multipart = new MimeMultipart();
                    MimeBodyPart htmlPart = new MimeBodyPart();
                    htmlPart.setContent(body, "text/html; charset=utf-8");
                    multipart.addBodyPart(htmlPart);

                    message.setContent(multipart);
                    finalMailSender.send(message);

                } catch (Exception e) {
                    logger.error("Failed to send HTML email to: {}", to, e);
                    SentryLogger.SentryEventBuilder.error(e)
                            .withMessage("Failed to send HTML email")
                            .withTag("notification.type", "EMAIL")
                            .withTag("email.type", emailType != null ? emailType : "HTML")
                            .withTag("recipient.email", to)
                            .withTag("institute.id", instituteId != null ? instituteId : "unknown")
                            .withTag("service", service != null ? service : "unknown")
                            .withTag("operation", "sendHtmlEmail")
                            .send();
                    throw new RuntimeException("Failed to send HTML email", e);
                }
            });

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Failed to send HTML email due to rate limiting", e);
        }
    }

    public void sendAttachmentEmail(String to, String subject, String service, String body,
            Map<String, byte[]> attachments, String instituteId) {
        try {
            // Skip sending email if the domain is in the blocked list
            if (EmailDomainBlocklistUtil.isEmailDomainBlocked(to)) {
                logger.info("Skipping attachment email for user with blocked email domain: {}", to);
                return;
            }
            
            logger.info("Preparing to send email to: {} with subject: {}", to, subject);

            AbstractMap.SimpleEntry<JavaMailSender, String> config = getMailSenderConfig(instituteId);
            JavaMailSender mailSenderToUse = config.getKey();
            String fromToUse = config.getValue();

            final String emailSubject = StringUtils.hasText(subject)
                    ? subject
                    : "This is a very important email";
            final String emailBody = body;

            final boolean includeSesHeader = shouldIncludeSesConfigurationHeader(instituteId);

            emailDispatcher.sendEmail(() -> {
                try {
                    logger.info("Setting up email session and message...");
                    Session session = Session.getDefaultInstance(new Properties(), null);
                    MimeMessage message = new MimeMessage(session);

                    message.setRecipient(Message.RecipientType.TO, new InternetAddress(to));
                    message.setFrom(new InternetAddress(fromToUse));
                    message.setSubject(emailSubject);

                    // Add SES configuration set header for event tracking
                    if (includeSesHeader) {
                        message.setHeader("X-SES-CONFIGURATION-SET", sesConfigurationSet);
                    }

                    MimeMultipart multipart = new MimeMultipart();

                    // Add HTML body
                    MimeBodyPart htmlPart = new MimeBodyPart();
                    htmlPart.setContent(emailBody, "text/html; charset=utf-8");
                    multipart.addBodyPart(htmlPart);

                    // Add attachments
                    if (attachments != null && !attachments.isEmpty()) {
                        for (Map.Entry<String, byte[]> entry : attachments.entrySet()) {
                            byte[] data = entry.getValue();
                            if (data != null && data.length > 0) {
                                MimeBodyPart attachmentPart = new MimeBodyPart();
                                ByteArrayDataSource dataSource = new ByteArrayDataSource(data, "application/pdf");
                                attachmentPart.setDataHandler(new DataHandler(dataSource));
                                attachmentPart.setFileName(entry.getKey());
                                multipart.addBodyPart(attachmentPart);
                            }
                        }
                    }

                    message.setContent(multipart);

                    logger.info("Sending email to: {}", to);
                    mailSenderToUse.send(message);
                    logger.info("Email successfully sent to: {}", to);

                } catch (MessagingException e) {
                    logger.error("Error while preparing or sending the email", e);
                    SentryLogger.SentryEventBuilder.error(e)
                            .withMessage("Failed to send email with attachments")
                            .withTag("notification.type", "EMAIL")
                            .withTag("email.type", "ATTACHMENT")
                            .withTag("recipient.email", to)
                            .withTag("institute.id", instituteId != null ? instituteId : "unknown")
                            .withTag("attachment.count", String.valueOf(attachments != null ? attachments.size() : 0))
                            .withTag("operation", "sendAttachmentEmail")
                            .send();
                    throw new RuntimeException("Failed to send email with attachments", e);
                }
            });

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logger.error("Email sending interrupted due to rate limiting", e);
            throw new RuntimeException("Failed to send email due to rate limiting", e);
        } catch (Exception e) {
            logger.error("An error occurred while preparing the email", e);
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Failed to prepare attachment email")
                    .withTag("notification.type", "EMAIL")
                    .withTag("email.type", "ATTACHMENT")
                    .withTag("recipient.email", to)
                    .withTag("institute.id", instituteId != null ? instituteId : "unknown")
                    .withTag("attachment.count", String.valueOf(attachments != null ? attachments.size() : 0))
                    .withTag("operation", "prepareAttachmentEmail")
                    .send();
            throw new RuntimeException("An error occurred while preparing the email", e);
        }
    }

    /**
     * Resolve all available email senders for an institute (type + from address).
     */
    public List<EmailSenderInfo> listInstituteEmailSenders(String instituteId) {
        Set<EmailSenderInfo> senders = new LinkedHashSet<>();
        senders.add(new EmailSenderInfo(NotificationConstants.UTILITY_EMAIL, from));

        if (!StringUtils.hasText(instituteId)) {
            return new ArrayList<>(senders);
        }

        try {
            List<EmailConfigDTO> configurations = emailConfigurationService.getEmailConfigurations(instituteId);
            configurations.stream()
                    .filter(Objects::nonNull)
                    .forEach(config -> {
                        String type = config.getType();
                        String email = config.getEmail();
                        if (StringUtils.hasText(type) && StringUtils.hasText(email)) {
                            senders.add(new EmailSenderInfo(type.trim().toUpperCase(), email.trim()));
                        }
                    });
        } catch (Exception e) {
            logger.warn("Failed to resolve institute email senders for {}: {}", instituteId, e.getMessage());
        }

        return new ArrayList<>(senders);
    }

    private String resolveFromAddress(JsonNode config, String defaultFrom) {
        if (config == null || config.isMissingNode()) {
            return defaultFrom;
        }

        String fromAddress = config.path(NotificationConstants.FROM).asText(null);
        if (!StringUtils.hasText(fromAddress)) {
            fromAddress = config.path("fromEmail").asText(null);
        }
        if (!StringUtils.hasText(fromAddress)) {
            fromAddress = config.path("fromAddress").asText(null);
        }
        if (!StringUtils.hasText(fromAddress)) {
            fromAddress = config.path("from_email").asText(null);
        }
        if (!StringUtils.hasText(fromAddress)) {
            fromAddress = config.path("from_email_address").asText(null);
        }
        if (!StringUtils.hasText(fromAddress)) {
            fromAddress = config.path("email").asText(null);
        }

        if (!StringUtils.hasText(fromAddress)) {
            return defaultFrom;
        }
        return fromAddress.trim();
    }

    public static class EmailSenderInfo {
        private final String emailType;
        private final String fromAddress;

        public EmailSenderInfo(String emailType, String fromAddress) {
            this.emailType = emailType;
            this.fromAddress = fromAddress;
        }

        public String getEmailType() {
            return emailType;
        }

        public String getFromAddress() {
            return fromAddress;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o)
                return true;
            if (!(o instanceof EmailSenderInfo that))
                return false;
            return Objects.equals(emailType, that.emailType) &&
                    Objects.equals(fromAddress, that.fromAddress);
        }

        @Override
        public int hashCode() {
            return Objects.hash(emailType, fromAddress);
        }
    }
}