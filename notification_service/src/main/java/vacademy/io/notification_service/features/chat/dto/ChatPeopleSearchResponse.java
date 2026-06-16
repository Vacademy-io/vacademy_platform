package vacademy.io.notification_service.features.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatPeopleSearchResponse {
    private List<ChatPersonResponse> people;
    private int pageNumber;
    private int pageSize;
    private long totalElements;
    private boolean hasNext;
}
