package vacademy.io.common.notification.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
@Builder
public class WhatsAppOTPRequest {
    private String to; // Mobile number: +919876543210
    private String service; // "auth-service"
    private String name; // User's name for personalization
    private String otp; // For verification only
}
