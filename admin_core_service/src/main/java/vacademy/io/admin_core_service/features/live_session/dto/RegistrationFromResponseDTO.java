package vacademy.io.admin_core_service.features.live_session.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Getter
@Setter
@AllArgsConstructor
public class RegistrationFromResponseDTO {
    private String sessionId;
    private String sessionTitle;
    private LocalDateTime startTime;
    private LocalDateTime lastEntryTime;
    private String accessLevel;
    private String instituteId;
    private String subject;
    private String coverFileId;
    private List<CustomFieldDTO> customFields;

    // Paid live sessions — set after construction; null/false for free sessions.
    private Boolean paymentRequired;
    private Double price;
    private String currency;

    // Contact verification the public form must run before registering
    // (email OTP / WhatsApp OTP). Null/false = no verification.
    private Boolean requireEmailVerification;
    private Boolean requirePhoneVerification;

    @Data
    @AllArgsConstructor
    public static class CustomFieldDTO {
        private String id;
        private String fieldKey;
        private String fieldName;
        private String fieldType;
        private String defaultValue;
        private String config;
        private int formOrder;
        private boolean isMandatory;
        private boolean isFilter;
        private boolean isSortable;
        private boolean isHidden;
    }
}
