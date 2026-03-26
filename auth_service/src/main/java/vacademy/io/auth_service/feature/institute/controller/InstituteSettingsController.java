package vacademy.io.auth_service.feature.institute.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.institute.service.InstituteSettingsService;

import java.util.Map;

/**
 * JWT-protected endpoint for admin dashboard to update session limit.
 * Path is NOT under /internal/ so it uses standard JWT auth.
 */
@RestController
@RequestMapping("/auth-service/v1/institute-settings")
public class InstituteSettingsController {

    @Autowired
    private InstituteSettingsService instituteSettingsService;

    @PostMapping("/update-max-sessions")
    public ResponseEntity<String> updateMaxSessions(@RequestBody Map<String, Object> body) {
        String instituteId = (String) body.get("institute_id");
        int maxSessions = Integer.parseInt(body.get("max_active_sessions").toString());
        instituteSettingsService.updateMaxActiveSessions(instituteId, maxSessions);
        return ResponseEntity.ok("max_active_sessions updated for institute: " + instituteId);
    }
}
