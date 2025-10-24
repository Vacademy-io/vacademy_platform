package vacademy.io.admin_core_service.features.enrollment_policy.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;

@Data
@SuperBuilder
@NoArgsConstructor
@EqualsAndHashCode(callSuper = true)
@JsonIgnoreProperties(ignoreUnknown = true)
public class WhatsAppNotificationContentDTO extends NotificationConfigDTO {
    WhatsAppContent content;

    @Data
    @SuperBuilder
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class WhatsAppContent {
        String templateName;
        List<String> parameters;
    }
}