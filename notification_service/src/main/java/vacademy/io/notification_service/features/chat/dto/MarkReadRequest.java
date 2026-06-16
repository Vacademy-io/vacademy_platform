package vacademy.io.notification_service.features.chat.dto;

import lombok.Data;

@Data
public class MarkReadRequest {
    private String upToMessageId;
}
