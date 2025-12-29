package vacademy.io.admin_core_service.features.enrollment_policy.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@EqualsAndHashCode(callSuper = true)
@JsonIgnoreProperties(ignoreUnknown = true)
public class EmailNotificationContentDTO extends NotificationConfigDTO {
    EmailContent content;

    @Data
    @SuperBuilder
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class EmailContent {
        String subject;
        String body;
    }
}