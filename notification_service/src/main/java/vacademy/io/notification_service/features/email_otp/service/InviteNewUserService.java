package vacademy.io.notification_service.features.email_otp.service;

import jakarta.mail.MessagingException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.service.EmailService;

@Service
public class InviteNewUserService {

    @Autowired
    EmailService emailService;


    public Boolean sendEmail(String to, String subject, String service, String body) {
        try {
            emailService.sendHtmlEmail(to, subject, service, body);
        } catch (Exception e) {
            return false;
        }
        return true;
    }
}