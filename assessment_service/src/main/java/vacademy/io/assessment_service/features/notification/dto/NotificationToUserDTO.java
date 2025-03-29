package vacademy.io.assessment_service.features.notification.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Builder
public class NotificationToUserDTO {
    private Map<String, String> placeholders;
    private String channelId;
    private String userId;
}
