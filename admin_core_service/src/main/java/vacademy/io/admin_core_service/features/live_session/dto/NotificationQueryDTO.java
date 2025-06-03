package vacademy.io.admin_core_service.features.live_session.dto;


import java.time.*;

public interface NotificationQueryDTO {
    String getNotificationId();
    String getSessionId();
    String getType();
    String getMessage();
    String getStatus();
    String getChannel();
    LocalDateTime getTriggerTime();
    Integer getOffsetMinutes();
}

