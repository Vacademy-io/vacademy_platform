package vacademy.io.notification_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.notification.dto.EmailOTPRequest;
import vacademy.io.notification_service.features.email_otp.service.OTPService;

@RestController
@RequestMapping("notification-service/internal/v1")
public class OtpInternalController {

    @Autowired
    private OTPService otpService;

    @PostMapping("/send-email-otp")
    public ResponseEntity<String> sendEmailOtp(@RequestBody EmailOTPRequest request,
            @RequestParam(name = "instituteId", required = false) String instituteId) {
        otpService.sendEmailOtp(request.getTo(), request.getSubject(), request.getService(), request.getName(),
                instituteId);
        return ResponseEntity.ok("Email OTP sent successfully");
    }

    @PostMapping("/verify-email-otp")
    public ResponseEntity<Boolean> verifyEmailOtp(@RequestBody EmailOTPRequest request) {
        if (otpService.verifyEmailOtp(request.getOtp(), request.getTo()))
            return ResponseEntity.ok(true);
        return ResponseEntity.ok(false);
    }

    /**
     * Send OTP - supports both EMAIL and WHATSAPP based on type field
     */
    @PostMapping("/send-otp")
    public ResponseEntity<String> sendOtp(@RequestBody EmailOTPRequest request,
            @RequestParam(name = "instituteId", required = false) String instituteId) {
        String type = request.getType() != null ? request.getType().toUpperCase() : "EMAIL";

        if ("WHATSAPP".equals(type)) {
            Boolean sent = otpService.sendWhatsAppOtp(request.getPhoneNumber(), instituteId);
            if (sent) {
                return ResponseEntity.ok("WhatsApp OTP sent successfully");
            } else {
                return ResponseEntity.status(500).body("Failed to send WhatsApp OTP");
            }
        } else {
            otpService.sendEmailOtp(request.getTo(), request.getSubject(), request.getService(), request.getName(),
                    instituteId);
            return ResponseEntity.ok("Email OTP sent successfully");
        }
    }

    /**
     * Verify OTP - supports both EMAIL and WHATSAPP based on type field
     */
    @PostMapping("/verify-otp")
    public ResponseEntity<Boolean> verifyOtp(@RequestBody EmailOTPRequest request) {
        String type = request.getType() != null ? request.getType().toUpperCase() : "EMAIL";

        if ("WHATSAPP".equals(type)) {
            if (otpService.verifyWhatsAppOtp(request.getOtp(), request.getPhoneNumber())) {
                return ResponseEntity.ok(true);
            }
        } else {
            if (otpService.verifyEmailOtp(request.getOtp(), request.getTo())) {
                return ResponseEntity.ok(true);
            }
        }
        return ResponseEntity.ok(false);
    }

}