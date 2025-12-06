package vacademy.io.admin_core_service.features.enrollment_policy.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationType;

@Data
@SuperBuilder // <-- ADDED THIS
@NoArgsConstructor // <-- ADDED THIS
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonTypeInfo(
        use = JsonTypeInfo.Id.NAME,
        include = JsonTypeInfo.As.PROPERTY,
        property = "type",
        visible = true
)
@JsonSubTypes({
        @JsonSubTypes.Type(value = EmailNotificationContentDTO.class, name = "EMAIL"),
        @JsonSubTypes.Type(value = WhatsAppNotificationContentDTO.class, name = "WHATSAPP")
})
public abstract class NotificationConfigDTO {
    NotificationType type;
}
