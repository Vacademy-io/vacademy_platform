package vacademy.io.auth_service.feature.institute.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.institute.dto.UpdateInstituteSettingsDTO;
import vacademy.io.auth_service.feature.institute.service.InstituteSettingsService;

import java.util.Map;

@RestController
public class InstituteSettingsInternalController {

    @Autowired
    private InstituteSettingsService instituteSettingsService;

    /**
     * Called by admin_core_service (via HMAC).
     */
    @PutMapping("/auth-service/internal/institute-settings")
    public ResponseEntity<String> updateSettings(@RequestBody UpdateInstituteSettingsDTO request) {
        instituteSettingsService.updateInstituteSettings(request);
        return ResponseEntity.ok("Settings updated successfully");
    }

    /**
     * Called by admin_core_service (via HMAC) when the admin sets MAX_ACTIVE_SESSIONS.
     * POST /auth-service/internal/institute-settings/sync-max-sessions
     */
    @PostMapping("/auth-service/internal/institute-settings/sync-max-sessions")
    public ResponseEntity<String> syncMaxSessions(@RequestBody Map<String, Object> body) {
        String instituteId = (String) body.get("institute_id");
        int maxSessions = Integer.parseInt(body.get("max_active_sessions").toString());
        instituteSettingsService.updateMaxActiveSessions(instituteId, maxSessions);
        return ResponseEntity.ok("max_active_sessions synced for institute: " + instituteId);
    }

    /**
     * Called by admin-dashboard frontend (via JWT) to sync max_active_sessions.
     * POST /auth-service/v1/institute-settings/update-max-sessions
     * Body: { "institute_id": "...", "max_active_sessions": 3 }
     */
    @PostMapping("/auth-service/v1/institute-settings/update-max-sessions")
    public ResponseEntity<String> updateMaxSessions(@RequestBody Map<String, Object> body) {
        String instituteId = (String) body.get("institute_id");
        int maxSessions = Integer.parseInt(body.get("max_active_sessions").toString());
        instituteSettingsService.updateMaxActiveSessions(instituteId, maxSessions);
        return ResponseEntity.ok("max_active_sessions synced for institute: " + instituteId);
    }
}
