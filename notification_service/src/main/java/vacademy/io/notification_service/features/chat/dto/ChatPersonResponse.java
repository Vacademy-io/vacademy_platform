package vacademy.io.notification_service.features.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatPersonResponse {
    private String userId;
    private String fullName;
    private String email;
    private String mobileNumber;
    private String role; // normalized: STUDENT | TEACHER | ADMIN
}
