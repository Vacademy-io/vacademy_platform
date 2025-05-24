package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.live_session.dto.NotificationToUserDTO;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class NotificationDTO {
    private String body;
    private String notificationType;
    private String subject;
    private String source;
    private String sourceId;
    private List<NotificationToUserDTO> users;
}
