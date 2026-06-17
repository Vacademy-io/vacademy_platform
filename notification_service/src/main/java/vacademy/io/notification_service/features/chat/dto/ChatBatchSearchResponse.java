package vacademy.io.notification_service.features.chat.dto;

import lombok.Data;

import java.util.List;

@Data
public class ChatBatchSearchResponse {
    private List<ChatBatchResponse> batches;
}
