package vacademy.io.admin_core_service.features.live_session.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.dto.AdminMarkAttendanceRequestDTO;
import vacademy.io.admin_core_service.features.live_session.dto.MarkAttendanceRequestDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionLogs;
import vacademy.io.admin_core_service.features.live_session.enums.SessionLog;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionLogsRepository;
import vacademy.io.admin_core_service.features.live_session.scheduler.LiveSessionNotificationProcessor;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.sql.Timestamp;
import java.util.Map;
import java.util.Optional;

@Service
public class LIveSessionAttendanceService {

    @Autowired
    private LiveSessionLogsRepository liveSessionLogRepository;

    @Autowired
    private LiveSessionNotificationProcessor notificationProcessor;

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
            log.setStatusType("ONLINE");
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
                    .statusType("ONLINE")
                    .details(request.getDetails())
                    .createdAt(new Timestamp(System.currentTimeMillis()))
                    .updatedAt(new Timestamp(System.currentTimeMillis()))
                    .build();

            liveSessionLogRepository.save(log);
        }

        // Send attendance notification to learner
        notificationProcessor.sendAttendanceNotification(request.getSessionId(), userId, "PRESENT");
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
            log.setStatusType("ONLINE");
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
                    .statusType("ONLINE")
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
            log.setStatusType("ONLINE");
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
                    .statusType("ONLINE")
                    .details(request.getDetails())
                    .createdAt(new Timestamp(System.currentTimeMillis()))
                    .updatedAt(new Timestamp(System.currentTimeMillis()))
                    .build();

            liveSessionLogRepository.save(log);
        }
    }

    /**
     * Admin batch marking — sets statusType=OFFLINE since admin is marking manually.
     * Returns a map with "updated" and "created" counts.
     */
    public Map<String, Integer> adminMarkAttendance(AdminMarkAttendanceRequestDTO request) {
        int updated = 0;
        int created = 0;

        for (AdminMarkAttendanceRequestDTO.AttendanceEntry entry : request.getEntries()) {
            Optional<LiveSessionLogs> existingLog = liveSessionLogRepository.findExistingAttendanceRecord(
                    request.getScheduleId(),
                    entry.getUserSourceId()
            );

            if (existingLog.isPresent()) {
                LiveSessionLogs log = existingLog.get();
                log.setStatus(entry.getStatus());
                log.setStatusType("OFFLINE");
                if (entry.getDetails() != null && !entry.getDetails().isBlank()) {
                    log.setDetails(entry.getDetails());
                }
                log.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
                liveSessionLogRepository.save(log);
                updated++;
            } else {
                LiveSessionLogs log = LiveSessionLogs.builder()
                        .sessionId(request.getSessionId())
                        .scheduleId(request.getScheduleId())
                        .userSourceType(entry.getUserSourceType() != null ? entry.getUserSourceType() : "USER")
                        .userSourceId(entry.getUserSourceId())
                        .logType(SessionLog.ATTENDANCE_RECORDED.name())
                        .status(entry.getStatus())
                        .statusType("OFFLINE")
                        .details(entry.getDetails())
                        .createdAt(new Timestamp(System.currentTimeMillis()))
                        .updatedAt(new Timestamp(System.currentTimeMillis()))
                        .build();
                liveSessionLogRepository.save(log);
                created++;
            }

            // Send attendance notification to learner
            notificationProcessor.sendAttendanceNotification(
                    request.getSessionId(), entry.getUserSourceId(), entry.getStatus());
        }

        return Map.of("updated", updated, "created", created);
    }
}
