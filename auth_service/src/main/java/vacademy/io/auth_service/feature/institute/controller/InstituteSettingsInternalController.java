package vacademy.io.auth_service.feature.institute.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.institute.dto.UpdateInstituteSettingsDTO;
import vacademy.io.auth_service.feature.institute.service.InstituteSettingsService;

@RestController
@RequestMapping("/auth-service/internal/institute-settings")
public class InstituteSettingsInternalController {

    @Autowired
    private InstituteSettingsService instituteSettingsService;

    @PutMapping("")
    public ResponseEntity<String> updateSettings(@RequestBody UpdateInstituteSettingsDTO request) {
        instituteSettingsService.updateInstituteSettings(request);
        return ResponseEntity.ok("Settings updated successfully");
    }
}
