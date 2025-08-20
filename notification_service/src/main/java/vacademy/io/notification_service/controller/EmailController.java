package vacademy.io.notification_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.notification.dto.EmailOTPRequest;
import vacademy.io.common.notification.dto.GenericEmailRequest;
import vacademy.io.notification_service.dto.EmailRequest;
import vacademy.io.notification_service.dto.NotificationDTO;
import vacademy.io.notification_service.features.email_otp.service.OTPService;
import vacademy.io.notification_service.service.EmailService;
import vacademy.io.notification_service.service.NotificationService;

@RestController
@RequestMapping("notification-service/v1")
public class EmailController {

    private final EmailService emailService;

    private final OTPService otpService;

    private final NotificationService notificationService;

    @Autowired
    public EmailController(EmailService emailService, OTPService otpService, NotificationService notificationService) {
        this.emailService = emailService;
        this.otpService = otpService;
        this.notificationService = notificationService;
    }

    @PostMapping("/send-email")
    public String sendEmail(@RequestBody EmailRequest request, @RequestParam(name = "instituteId",required = false) String instituteId) {
        emailService.sendEmail(request.getTo(), request.getSubject(), request.getText(),instituteId);

        return "Email sent successfully";
    }

    @PostMapping("/verify-email-otp")
    public ResponseEntity<String> verifyEmailOtp(@RequestBody EmailOTPRequest request) {
        if (otpService.verifyEmailOtp(request.getOtp(), request.getTo()))
            return ResponseEntity.ok("Email Verified Successfully");
        throw new RuntimeException("Invalid OTP");
    }

    @PostMapping("/send-email-otp")
    public ResponseEntity<String> sendEmailOtp(@RequestBody EmailOTPRequest request, @RequestParam(name = "instituteId",required = false)String instituteId) {
        otpService.sendEmailOtp(request.getTo(), request.getSubject(), request.getService(), request.getName(),instituteId);
        return ResponseEntity.ok("Email OTP sent successfully");
    }

    @PostMapping("/send-html-email")
    public ResponseEntity<Boolean> sendEmail(@RequestBody GenericEmailRequest request,@RequestParam(name = "instituteId",required = false)String instituteId) {
        try {
            emailService.sendHtmlEmail(request.getTo(), request.getSubject(), request.getService(), request.getBody(),instituteId);
            return ResponseEntity.ok(true);
        } catch (Exception e) {
            return ResponseEntity.ok(false);
        }
    }

    @PostMapping("/send-email-to-users")
    public ResponseEntity<String> sendEmailsToUsers(@RequestBody NotificationDTO emailToUsersDTO,@RequestParam(name = "instituteId",required = false)String instituteId) {
        return ResponseEntity.ok(notificationService.sendNotification(emailToUsersDTO,instituteId));
    }

    @PostMapping("/send-email-to-users-public")
    public ResponseEntity<String> sendEmailsToUsersPublic(@RequestBody NotificationDTO emailToUsersDTO,@RequestParam(name = "instituteId",required = false)String instituteId) {
        return ResponseEntity.ok(notificationService.sendNotification(emailToUsersDTO,instituteId));
    }

}