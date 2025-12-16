package vacademy.io.admin_core_service.features.course_settings.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.course_settings.dto.DripConditionSettingsDTO;
import vacademy.io.admin_core_service.features.course_settings.service.DripConditionService;

@RestController
@RequestMapping("/admin-core-service/course-settings/v1")
@RequiredArgsConstructor
public class DripConditionController {

        private final DripConditionService dripConditionService;

        @PostMapping("/save-drip-settings")
        public ResponseEntity<String> saveDripSettings(@RequestBody DripConditionSettingsDTO settingsDTO) {
                dripConditionService.saveDripConditionSettings(settingsDTO);
                return ResponseEntity.ok("Drip condition settings saved successfully");
        }
}
