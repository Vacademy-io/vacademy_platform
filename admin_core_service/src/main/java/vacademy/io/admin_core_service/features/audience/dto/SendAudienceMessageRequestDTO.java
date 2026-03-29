package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SendAudienceMessageRequestDTO {

    private String audienceId;
    private String instituteId;
    private String channel;           // WHATSAPP, EMAIL, PUSH, SYSTEM_ALERT

    // Template (for WA + optional email)
    private String templateName;
    private String languageCode;      // WA language code (default: en)

    // Email/Push direct content
    private String subject;           // email subject or push title
    private String body;              // email HTML body or push body
    private String emailType;         // UTILITY_EMAIL, PROMOTIONAL_EMAIL

    // Variable mapping: { "templateVarName": "system:full_name" | "custom:{fieldId}" }
    private Map<String, String> variableMapping;

    // Optional filters to narrow recipients
    private AudienceFilterConfig filters;

    // Who is sending
    private String createdBy;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class AudienceFilterConfig {
        private String sourceType;
        private String submittedFrom;     // ISO date
        private String submittedTo;
        private Map<String, String> customFieldFilters; // fieldId -> value
    }
}
