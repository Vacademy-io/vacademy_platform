package vacademy.io.admin_core_service.features.live_session.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.dto.MarkAttendanceRequestDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionLogs;
import vacademy.io.admin_core_service.features.live_session.enums.SessionLog;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionLogsRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.sql.Timestamp;

@Service
public class LIveSessionAttendanceService {

    @Autowired
    private LiveSessionLogsRepository liveSessionLogRepository;

    public void markAttendance(MarkAttendanceRequestDTO request , CustomUserDetails user) {
        LiveSessionLogs log = LiveSessionLogs.builder()
                .sessionId(request.getSessionId())
                .scheduleId(request.getScheduleId())
                .userSourceType(request.getUserSourceType())
                .userSourceId(request.getUserSourceId().isEmpty() ? user.getUserId() : request.getUserSourceId() )
                .logType(SessionLog.ATTENDANCE_RECORDED.name())
                .status("PRESENT")
                .details(request.getDetails())
                .createdAt(new Timestamp(System.currentTimeMillis()))
                .updatedAt(new Timestamp(System.currentTimeMillis()))
                .build();

        liveSessionLogRepository.save(log);
    }
}
