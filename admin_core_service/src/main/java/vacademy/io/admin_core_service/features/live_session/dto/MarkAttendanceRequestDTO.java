package vacademy.io.admin_core_service.features.live_session.dto;



import lombok.Data;

@Data
public class MarkAttendanceRequestDTO {
    private String sessionId;
    private String scheduleId;
    private String userSourceType;
    private String userSourceId;
    private String details; // Optional: for any notes
}

