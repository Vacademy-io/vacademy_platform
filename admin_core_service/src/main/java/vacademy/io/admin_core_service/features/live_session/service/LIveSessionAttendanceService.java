package vacademy.io.admin_core_service.features.live_session.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.dto.MarkAttendanceRequestDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionLogs;
import vacademy.io.admin_core_service.features.live_session.enums.SessionLog;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionLogsRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.sql.Timestamp;
import java.util.Optional;

@Service
public class LIveSessionAttendanceService {

    @Autowired
    private LiveSessionLogsRepository liveSessionLogRepository;

    public void markAttendance(MarkAttendanceRequestDTO request , CustomUserDetails user) {
        String userId = request.getUserSourceId().isEmpty() ? user.getUserId() : request.getUserSourceId();
        
        // Check if attendance record already exists for this schedule and user
        Optional<LiveSessionLogs> existingLog = liveSessionLogRepository.findExistingAttendanceRecord(
            request.getScheduleId(), 
            userId
        );
        
        if (existingLog.isPresent()) {
            // Update existing record
            LiveSessionLogs log = existingLog.get();
            log.setStatus("PRESENT");
            log.setDetails(request.getDetails());
            log.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
            liveSessionLogRepository.save(log);
        } else {
            // Create new record
            LiveSessionLogs log = LiveSessionLogs.builder()
                    .sessionId(request.getSessionId())
                    .scheduleId(request.getScheduleId())
                    .userSourceType(request.getUserSourceType())
                    .userSourceId(userId)
                    .logType(SessionLog.ATTENDANCE_RECORDED.name())
                    .status("PRESENT")
                    .details(request.getDetails())
                    .createdAt(new Timestamp(System.currentTimeMillis()))
                    .updatedAt(new Timestamp(System.currentTimeMillis()))
                    .build();

            liveSessionLogRepository.save(log);
        }
    }
    public void markGuestAttendance(MarkAttendanceRequestDTO request ) {
        // Check if attendance record already exists for this schedule and user
        Optional<LiveSessionLogs> existingLog = liveSessionLogRepository.findExistingAttendanceRecord(
            request.getScheduleId(), 
            request.getUserSourceId()
        );
        
        if (existingLog.isPresent()) {
            // Update existing record
            LiveSessionLogs log = existingLog.get();
            log.setStatus("PRESENT");
            log.setDetails(request.getDetails());
            log.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
            liveSessionLogRepository.save(log);
        } else {
            // Create new record
            LiveSessionLogs log = LiveSessionLogs.builder()
                    .sessionId(request.getSessionId())
                    .scheduleId(request.getScheduleId())
                    .userSourceType(request.getUserSourceType())
                    .userSourceId(request.getUserSourceId())
                    .logType(SessionLog.ATTENDANCE_RECORDED.name())
                    .status("PRESENT")
                    .details(request.getDetails())
                    .createdAt(new Timestamp(System.currentTimeMillis()))
                    .updatedAt(new Timestamp(System.currentTimeMillis()))
                    .build();

            liveSessionLogRepository.save(log);
        }
    }
    public void markAttendanceForGuest(MarkAttendanceRequestDTO request ) {
        // Check if attendance record already exists for this schedule and user
        Optional<LiveSessionLogs> existingLog = liveSessionLogRepository.findExistingAttendanceRecord(
            request.getScheduleId(), 
            request.getUserSourceId()
        );
        
        if (existingLog.isPresent()) {
            // Update existing record
            LiveSessionLogs log = existingLog.get();
            log.setStatus("PRESENT");
            log.setDetails(request.getDetails());
            log.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
            liveSessionLogRepository.save(log);
        } else {
            // Create new record
            LiveSessionLogs log = LiveSessionLogs.builder()
                    .sessionId(request.getSessionId())
                    .scheduleId(request.getScheduleId())
                    .userSourceType(request.getUserSourceType())
                    .userSourceId( request.getUserSourceId() )
                    .logType(SessionLog.ATTENDANCE_RECORDED.name())
                    .status("PRESENT")
                    .details(request.getDetails())
                    .createdAt(new Timestamp(System.currentTimeMillis()))
                    .updatedAt(new Timestamp(System.currentTimeMillis()))
                    .build();

            liveSessionLogRepository.save(log);
        }
    }
}
