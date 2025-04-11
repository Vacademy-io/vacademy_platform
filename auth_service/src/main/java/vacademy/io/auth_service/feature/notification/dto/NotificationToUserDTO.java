package vacademy.io.auth_service.feature.notification.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.Map;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class NotificationToUserDTO {
    private Map<String, String> placeholders;
    private String channelId;
    private String userId;
}
