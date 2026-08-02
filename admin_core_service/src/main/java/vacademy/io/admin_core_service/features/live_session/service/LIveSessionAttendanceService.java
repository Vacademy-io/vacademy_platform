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
import java.util.UUID;

@Service
public class LIveSessionAttendanceService {

    @Autowired
    private LiveSessionLogsRepository liveSessionLogRepository;

    @Autowired
    private LiveSessionNotificationProcessor notificationProcessor;

    public void markAttendance(MarkAttendanceRequestDTO request , CustomUserDetails user) {
        String userId = request.getUserSourceId().isEmpty() ? user.getUserId() : request.getUserSourceId();

        upsertPresent(request, userId);

        // Send attendance notification to learner
        notificationProcessor.sendAttendanceNotification(request.getSessionId(), userId, "PRESENT");
    }

    public void markGuestAttendance(MarkAttendanceRequestDTO request ) {
        upsertPresent(request, request.getUserSourceId());
    }

    public void markAttendanceForGuest(MarkAttendanceRequestDTO request ) {
        upsertPresent(request, request.getUserSourceId());
    }

    /**
     * One atomic INSERT ... ON CONFLICT round trip instead of check-then-save.
     * A whole batch hits this concurrently at class start, so the flow must not
     * hold a connection across multiple statements or race on the existence
     * check (which historically produced duplicate attendance rows).
     */
    private void upsertPresent(MarkAttendanceRequestDTO request, String userSourceId) {
        liveSessionLogRepository.upsertAttendance(
                UUID.randomUUID().toString(),
                request.getSessionId(),
                request.getScheduleId(),
                request.getUserSourceType(),
                userSourceId,
                "PRESENT",
                "ONLINE",
                request.getDetails());
    }

    /**
     * Admin batch marking — sets statusType=OFFLINE since admin is marking manually.
     * Returns a map with "updated" and "created" counts. Stays on check-then-save
     * because the response shape needs per-row created/updated attribution and this
     * path is a single admin request, not a concurrent stampede; the V415 unique
     * index still backstops it against duplicates.
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
