package vacademy.io.admin_core_service.features.live_session.provider.controller.google;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.provider.service.google.GoogleRecordingService;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.meeting.dto.MeetingRecordingDTO;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * On-demand Google Meet recording sync — live-fetches {@code conferenceRecords.recordings} for a
 * schedule's space and persists them, bypassing the hourly poll (and its meeting-ended timing gate).
 * Lets an admin pull a recording into Vacademy the moment Google finishes processing it, rather than
 * waiting for the next scheduled sync.
 */
@RestController
@RequestMapping("/admin-core-service/live-sessions/provider/meeting")
@RequiredArgsConstructor
@Slf4j
public class GoogleRecordingController {

    private final SessionScheduleRepository scheduleRepository;
    private final GoogleRecordingService googleRecordingService;
    private final InstituteAccessValidator instituteAccessValidator;

    @PostMapping("/google-recordings/sync")
    public ResponseEntity<Map<String, Object>> syncNow(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam String scheduleId,
            @RequestParam(required = false) String instituteId) {

        SessionSchedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND,
                        "Schedule not found: " + scheduleId));

        String inst = instituteId != null ? instituteId
                : scheduleRepository.findInstituteIdByScheduleId(scheduleId).orElse(null);
        if (inst != null) {
            instituteAccessValidator.validateUserAccess(user, inst);
        }

        int synced = googleRecordingService.syncFromApi(schedule);
        List<MeetingRecordingDTO> recordings = googleRecordingService.getStored(schedule);

        log.info("google.recordings.sync-now scheduleId={} synced={} total={}",
                scheduleId, synced, recordings.size());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("synced", synced);
        body.put("recordings", recordings);
        return ResponseEntity.ok(body);
    }
}
