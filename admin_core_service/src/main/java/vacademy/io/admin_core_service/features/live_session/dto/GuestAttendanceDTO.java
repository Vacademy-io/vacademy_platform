package vacademy.io.admin_core_service.features.live_session.dto;

import java.sql.Timestamp;

public interface GuestAttendanceDTO {
    String getGuestEmail();
    Timestamp getRegisteredAt();
    String getAttendanceStatus();
    String getAttendanceDetails();
    Timestamp getAttendanceTimestamp();
    String getCustomFieldValue();
    String getGuestName();
    String getMobileNumber();
}

