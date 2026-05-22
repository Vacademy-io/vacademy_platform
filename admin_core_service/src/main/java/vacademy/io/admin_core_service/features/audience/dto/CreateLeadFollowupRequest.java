package vacademy.io.admin_core_service.features.audience.dto;

import lombok.Data;

import java.sql.Timestamp;

@Data
public class CreateLeadFollowupRequest {
    private String audienceResponseId;
    private String instituteId;
    private Timestamp scheduleTime;
    private String content;
}
