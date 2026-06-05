package vacademy.io.admin_core_service.features.telephony.core.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ConnectCallResponseDTO {
    private String callLogId;
    private String status;
    private String callerId;       // ExoPhone the lead will see — useful for UI display
    private String eventsStreamUrl;
}
