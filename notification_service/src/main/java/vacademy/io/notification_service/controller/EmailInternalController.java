package vacademy.io.notification_service.controller;

import jakarta.mail.MessagingException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.notification.dto.GenericEmailRequest;
import vacademy.io.notification_service.dto.EmailToUsersDTO;
import vacademy.io.notification_service.features.email_otp.service.InviteNewUserService;
import vacademy.io.notification_service.service.EmailService;

@RestController
@RequestMapping("notification-service/internal/common/v1")
public class EmailInternalController {

    @Autowired
    private InviteNewUserService inviteNewUserService;

    @Autowired
    private EmailService emailService;

    @PostMapping("/send-html-email")
    public ResponseEntity<Boolean> sendEmail(@RequestBody GenericEmailRequest request) {
        return ResponseEntity.ok(inviteNewUserService.sendEmail(request.getTo(), request.getSubject(), request.getService(), request.getBody()));
    }

    @PostMapping("/send-email-to-users")
    public ResponseEntity<String> sendEmailsToUsers(@RequestBody EmailToUsersDTO emailToUsersDTO) {
        try {
            emailService.sendEmailsToUsers(emailToUsersDTO);
            return ResponseEntity.ok("Emails sent successfully!");
        } catch (MessagingException e) {
            return ResponseEntity.status(500).body("Error occurred while sending emails: " + e.getMessage());
        }
    }

}