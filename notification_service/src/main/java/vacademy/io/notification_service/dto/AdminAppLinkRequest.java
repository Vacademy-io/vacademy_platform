package vacademy.io.notification_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request from the admin dashboard to send the Vacademy Admin app download link
 * to a phone number over WhatsApp (via the platform-default Vidyayatan account)
 * and notify the internal team about who requested it.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminAppLinkRequest {
    /** "ANDROID" or "IOS" */
    private String platform;
    private String phoneNumber;
    private String instituteId;
    private String instituteName;
    private String requesterName;
    private String requesterEmail;
}
