package vacademy.io.notification_service.features.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessagePageResponse {
    private List<ChatMessageResponse> messages; // ascending by seq for rendering
    private boolean hasMore;                     // older messages exist before the first item
    private Long oldestSeq;                       // cursor for the next "before" page
    private Long latestSeq;
}
