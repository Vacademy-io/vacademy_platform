package vacademy.io.notification_service.features.email_otp.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.service.EmailService;

@Service
public class InviteNewUserService {

    @Autowired
    EmailService emailService;


    public Boolean sendEmail(String to, String subject, String service, String body,String instituteId) {
        try {
            emailService.sendHtmlEmail(to, subject, service, body,instituteId);
        } catch (Exception e) {
            return false;
        }
        return true;
    }

    public Boolean sendTextEmail(String to,String subject ,String body,String instituteId){
        try{
            emailService.sendEmail(to,subject,body,instituteId);
        } catch (Exception e) {
            throw new RuntimeException("Email not send");
        }
        return true;
    }
}