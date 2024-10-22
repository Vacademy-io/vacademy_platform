package vacademy.io.common.notification.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AlertRecipientCreationDTO {
    private String recipientUserId;
    private String source;
    private String sourceId;
    private String status;
    private String name;
    private String email;
    private String phone;
}