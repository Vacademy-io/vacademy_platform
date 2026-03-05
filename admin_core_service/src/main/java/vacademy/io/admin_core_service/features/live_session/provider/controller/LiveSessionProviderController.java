package vacademy.io.admin_core_service.features.live_session.provider.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.provider.dto.ProviderMeetingCreateRequestDTO;
import vacademy.io.admin_core_service.features.live_session.provider.dto.ProviderConnectRequestDTO;
import vacademy.io.admin_core_service.features.live_session.provider.entity.LiveSessionProviderConfig;
import vacademy.io.admin_core_service.features.live_session.provider.service.LiveSessionProviderService;
import vacademy.io.common.meeting.dto.CreateMeetingResponseDTO;
import vacademy.io.common.meeting.dto.MeetingAttendeeDTO;
import vacademy.io.common.meeting.dto.MeetingRecordingDTO;

import java.util.List;
import java.util.Map;

/**
 * Live Session Provider REST API.
 * All endpoints require a valid JWT (enforced by the security filter chain).
 */
@RestController
@RequestMapping("/admin-core-service/live-sessions/provider")
@RequiredArgsConstructor
public class LiveSessionProviderController {

    private final LiveSessionProviderService providerService;

    // -----------------------------------------------------------------------
    // OAuth connect / status
    // -----------------------------------------------------------------------

    /**
     * One-time Zoho OAuth setup for an institute.
     * Admin generates the auth code from Zoho API Console → Self Client → Generate
     * Code.
     *
     * POST /admin-core/live-session/provider/connect/{providerName}
     */
    @PostMapping("/connect/{providerName}")
    public ResponseEntity<LiveSessionProviderConfig> connectProvider(
            @PathVariable String providerName,
            @RequestBody ProviderConnectRequestDTO request) {
        LiveSessionProviderConfig config = providerService.connectProvider(providerName, request);
        // Mask secrets before responding — configJson is not exposed in the entity
        // response
        config.setConfigJson(null);
        return ResponseEntity.ok(config);
    }

    /**
     * GET /admin-core/live-session/provider/status?instituteId=xxx
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getProviderStatus(
            @RequestParam String instituteId,
            @RequestParam(required = false, defaultValue = "ZOHO_MEETING") String provider) {
        boolean isConnected = providerService.isProviderConnected(instituteId, provider);
        return ResponseEntity.ok(Map.of(
                "instituteId", instituteId,
                "provider", provider,
                "isConnected", isConnected,
                "zohoMeetingConnected", isConnected)); // legacy frontend backward compatibility
    }

    /**
     * Returns the masked config (no secrets) for display on the admin dashboard.
     * GET
     * /admin-core/live-session/provider/config?instituteId=xxx&provider=ZOHO_MEETING
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getProviderConfig(
            @RequestParam String instituteId,
            @RequestParam String provider) {
        return providerService.getProviderConfigDisplay(instituteId, provider)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // -----------------------------------------------------------------------
    // Meeting operations
    // -----------------------------------------------------------------------

    /**
     * Create a meeting via the institute's connected provider.
     * Join URL is automatically written back to
     * session_schedule.custom_meeting_link.
     *
     * POST /admin-core/live-session/provider/meeting/create
     */
    @PostMapping("/meeting/create")
    public ResponseEntity<CreateMeetingResponseDTO> createMeeting(
            @RequestBody ProviderMeetingCreateRequestDTO request) {
        return ResponseEntity.ok(providerService.createMeeting(request));
    }

    /**
     * GET /admin-core/live-session/provider/meeting/recordings
     * ?scheduleId=xxx&instituteId=yyy
     */
    @GetMapping("/meeting/recordings")
    public ResponseEntity<List<MeetingRecordingDTO>> getRecordings(
            @RequestParam String scheduleId,
            @RequestParam String instituteId) {
        return ResponseEntity.ok(providerService.getRecordings(scheduleId, instituteId));
    }

    /**
     * GET /admin-core/live-session/provider/meeting/attendance
     * ?scheduleId=xxx&instituteId=yyy
     */
    @GetMapping("/meeting/attendance")
    public ResponseEntity<List<MeetingAttendeeDTO>> getAttendance(
            @RequestParam String scheduleId,
            @RequestParam String instituteId) {
        return ResponseEntity.ok(providerService.getAttendance(scheduleId, instituteId));
    }
}
