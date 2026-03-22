package vacademy.io.admin_core_service.features.live_session.dto;

import lombok.Data;

import java.util.List;

/**
 * Batch request for admin to manually mark attendance (PRESENT/ABSENT).
 * Records marked this way get statusType = OFFLINE.
 */
@Data
public class AdminMarkAttendanceRequestDTO {

    private String sessionId;
    private String scheduleId;
    private List<AttendanceEntry> entries;

    @Data
    public static class AttendanceEntry {
        private String userSourceId;
        private String userSourceType; // USER, GUEST, EXTERNAL_USER
        private String status;         // PRESENT or ABSENT
        private String details;        // optional notes
    }
}
