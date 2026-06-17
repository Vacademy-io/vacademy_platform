package vacademy.io.notification_service.features.chat.dto;

import lombok.Data;

@Data
public class ChatBatchSearchRequest {
    private String nameQuery;
    private int pageSize = 30;
}
