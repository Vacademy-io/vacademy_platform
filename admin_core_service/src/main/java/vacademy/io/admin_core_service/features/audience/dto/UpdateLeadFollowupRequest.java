package vacademy.io.admin_core_service.features.audience.dto;

import lombok.Data;

import java.sql.Timestamp;

@Data
public class UpdateLeadFollowupRequest {
    private Timestamp scheduleTime;
    private String content;
}
