package vacademy.io.notification_service.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.dto.WhatsAppOTPRequest;
import vacademy.io.notification_service.dto.WhatsAppOTPResponse;
import vacademy.io.notification_service.dto.WhatsAppOTPVerifyRequest;
import vacademy.io.notification_service.service.WhatsAppOTPService;

@RestController
@RequestMapping("notification-service/internal/v1")
@Slf4j
public class WhatsAppOTPController {

    @Autowired
    private WhatsAppOTPService whatsAppOTPService;

    /**
     * Send WhatsApp OTP to the given phone number
     * This is an internal endpoint called by auth-service
     */
    @PostMapping("/send-whatsapp-otp")
    public ResponseEntity<WhatsAppOTPResponse> sendWhatsAppOtp(@RequestBody WhatsAppOTPRequest request) {
        log.info("Received request to send WhatsApp OTP to phone: {}", request.getPhoneNumber());
        WhatsAppOTPResponse response = whatsAppOTPService.sendWhatsAppOtp(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Verify WhatsApp OTP
     * This is an internal endpoint called by auth-service
     */
    @PostMapping("/verify-whatsapp-otp")
    public ResponseEntity<Boolean> verifyWhatsAppOtp(@RequestBody WhatsAppOTPVerifyRequest request) {
        log.info("Received request to verify WhatsApp OTP for phone: {}", request.getPhoneNumber());
        Boolean isValid = whatsAppOTPService.verifyWhatsAppOtp(request.getPhoneNumber(), request.getOtp());
        return ResponseEntity.ok(isValid);
    }
}
