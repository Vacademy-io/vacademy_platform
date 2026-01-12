package vacademy.io.auth_service.feature.auth.dto;

import lombok.Data;

@Data
public class WhatsAppAuthRequestDto {
    private String mobileNumber; // +919876543210
    private String otp; // 123456 (when logging in)
    private String clientName; // ADMIN or STUDENT
    private String instituteId; // Optional
}
