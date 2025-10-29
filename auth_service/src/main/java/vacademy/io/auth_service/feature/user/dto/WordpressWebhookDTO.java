package vacademy.io.auth_service.feature.user.dto;

import lombok.Data;

@Data
public class WordpressWebhookDTO {
    private String userId;
    private String username;
    private String email;
}
