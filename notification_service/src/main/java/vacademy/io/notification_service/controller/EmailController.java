package vacademy.io.notification_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.notification.dto.EmailOTPRequest;
import vacademy.io.notification_service.dto.EmailRequest;
import vacademy.io.notification_service.features.email_otp.service.OTPService;
import vacademy.io.notification_service.service.EmailService;

/**
 * Email endpoints — OTP and simple email.
 * Bulk email, HTML email, WhatsApp, Push, System Alert all go through unified send API:
 * POST /notification-service/v1/send
 */
@RestController
@RequestMapping("notification-service/v1")
public class EmailController {

    private final EmailService emailService;
    private final OTPService otpService;

    @Autowired
    public EmailController(EmailService emailService, OTPService otpService) {
        this.emailService = emailService;
        this.otpService = otpService;
    }

    @PostMapping("/send-email")
    public String sendEmail(@RequestBody EmailRequest request, @RequestParam(name = "instituteId", required = false) String instituteId) {
        emailService.sendEmail(request.getTo(), request.getSubject(), request.getText(), instituteId);
        return "Email sent successfully";
    }

    @PostMapping("/verify-email-otp")
    public ResponseEntity<String> verifyEmailOtp(@RequestBody EmailOTPRequest request) {
        if (otpService.verifyEmailOtp(request.getOtp(), request.getTo()))
            return ResponseEntity.ok("Email Verified Successfully");
        throw new RuntimeException("Invalid OTP");
    }

    @PostMapping("/send-email-otp")
    public ResponseEntity<String> sendEmailOtp(@RequestBody EmailOTPRequest request, @RequestParam(name = "instituteId", required = false) String instituteId) {
        otpService.sendEmailOtp(request.getTo(), request.getSubject(), request.getService(), request.getName(), instituteId);
        return ResponseEntity.ok("Email OTP sent successfully");
    }
}