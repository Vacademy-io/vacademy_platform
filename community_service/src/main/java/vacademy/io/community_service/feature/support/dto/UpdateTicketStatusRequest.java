package vacademy.io.community_service.feature.support.dto;

import lombok.Data;

@Data
public class UpdateTicketStatusRequest {
    private String status;     // OPEN | IN_PROGRESS | WAITING_ON_CUSTOMER | RESOLVED | CLOSED
    private String priority;   // optional re-prioritisation (super-admin)
}
