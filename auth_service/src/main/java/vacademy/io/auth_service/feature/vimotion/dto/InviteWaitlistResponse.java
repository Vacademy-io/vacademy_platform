package vacademy.io.auth_service.feature.vimotion.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InviteWaitlistResponse {
    private AdminInviteCodeDTO code;
    /**
     * null when the admin chose "Generate (no email)";
     * true when notification_service confirmed delivery;
     * false when send was attempted but the underlying call failed.
     */
    private Boolean emailSent;
}
