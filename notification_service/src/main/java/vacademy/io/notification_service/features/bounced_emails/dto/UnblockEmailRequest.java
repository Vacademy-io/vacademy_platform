package vacademy.io.notification_service.features.bounced_emails.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for unblocking/reblocking an email
 */
@Data
@NoArgsConstructor
public class UnblockEmailRequest {
    private String email;
    
    public UnblockEmailRequest(String email) {
        this.email = email;
    }
}

