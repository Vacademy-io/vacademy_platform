package vacademy.io.notification_service.features.chat.dto;

import lombok.Data;

@Data
public class StartDirectRequest {
    private String targetUserId;
    private String targetUserName; // optional snapshot for the member row / title
    private String targetUserRole; // optional; resolved if absent
}
