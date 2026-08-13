package vacademy.io.admin_core_service.features.learner_offline.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineLearnerSettingsDTO;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineSettingService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Tells the learner app whether offline access is switched on for this institute
 * at all.
 *
 * The manifest already answers "can THIS course be downloaded", but the app also
 * needs a global answer before it shows any offline surface (the Downloads nav
 * entry, the screen itself). Without it the learner saw an Offline Downloads
 * section even when their institute had the feature turned off — a dead end that
 * could never contain anything.
 */
@RestController
@RequestMapping("/admin-core-service/learner-offline/v1")
@RequiredArgsConstructor
public class LearnerOfflineSettingsController {

    private final OfflineSettingService offlineSettingService;

    @GetMapping("/settings")
    public ResponseEntity<OfflineLearnerSettingsDTO> getSettings(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId) {
        var settings = offlineSettingService.get(instituteId);
        return ResponseEntity.ok(new OfflineLearnerSettingsDTO(
                settings.isEnabled(),
                settings.getRevalidationDays(),
                settings.getMaxDevices()));
    }
}
