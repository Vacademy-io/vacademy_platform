package vacademy.io.notification_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.notification.dto.EmailOTPRequest;
import vacademy.io.notification_service.constants.NotificationConstants;
import vacademy.io.notification_service.dto.EmailRequest;
import vacademy.io.notification_service.features.announcements.service.UserAnnouncementPreferenceService;
import vacademy.io.notification_service.features.email_otp.service.OTPService;
import vacademy.io.notification_service.service.EmailService;

import lombok.extern.slf4j.Slf4j;

/**
 * Email endpoints — OTP and simple email.
 * Bulk email, HTML email, WhatsApp, Push, System Alert all go through unified send API:
 * POST /notification-service/v1/send
 */
@Slf4j
@RestController
@RequestMapping("notification-service/v1")
public class EmailController {

    private final EmailService emailService;
    private final OTPService otpService;
    private final UserAnnouncementPreferenceService userAnnouncementPreferenceService;

    @Autowired
    public EmailController(EmailService emailService, OTPService otpService,
                           UserAnnouncementPreferenceService userAnnouncementPreferenceService) {
        this.emailService = emailService;
        this.otpService = otpService;
        this.userAnnouncementPreferenceService = userAnnouncementPreferenceService;
    }

    @PostMapping("/send-email")
    public String sendEmail(@RequestBody EmailRequest request, @RequestParam(name = "instituteId", required = false) String instituteId) {
        // Check if user has unsubscribed from this email sender
        if (StringUtils.hasText(request.getUserId()) && StringUtils.hasText(instituteId)) {
            try {
                String fromAddress = emailService.resolveFromEmailAddress(instituteId, NotificationConstants.UTILITY_EMAIL);
                if (fromAddress != null && userAnnouncementPreferenceService.isEmailSenderUnsubscribed(
                        request.getUserId(), instituteId, NotificationConstants.UTILITY_EMAIL, fromAddress)) {
                    log.info("Skipping email to user {} ({}): unsubscribed from {} ({})",
                            request.getUserId(), request.getTo(), fromAddress, NotificationConstants.UTILITY_EMAIL);
                    return "Email skipped - user unsubscribed";
                }
            } catch (Exception e) {
                log.warn("Failed to check unsubscribe preference for user {}: {}", request.getUserId(), e.getMessage());
            }
        }

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
