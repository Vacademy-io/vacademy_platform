package vacademy.io.notification_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import vacademy.io.notification_service.dto.WhatsAppOTPRequest;
import vacademy.io.notification_service.dto.WhatsAppOTPResponse;

public interface WhatsAppServiceProvider {
    WhatsAppOTPResponse sendOtp(WhatsAppOTPRequest request, String otp, JsonNode credentials);
}
