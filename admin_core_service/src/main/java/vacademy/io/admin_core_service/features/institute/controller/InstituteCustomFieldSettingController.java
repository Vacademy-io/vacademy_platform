package vacademy.io.admin_core_service.features.institute.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldSettingRequest;
import vacademy.io.admin_core_service.features.institute.manager.InstituteSettingManager;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/institute/v1/custom-field")
public class InstituteCustomFieldSettingController {

    private final InstituteSettingManager instituteSettingManager;

    public InstituteCustomFieldSettingController(InstituteSettingManager instituteSettingManager) {
        this.instituteSettingManager = instituteSettingManager;
    }

    @PostMapping("/create-or-update")
    public ResponseEntity<String> updateCustomFieldSetting(@RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId,
            @RequestBody CustomFieldSettingRequest request,
            @RequestParam(value = "isPresent", required = false) String isPresent) {
        return instituteSettingManager.updateCustomFieldSetting(userDetails, instituteId, request, isPresent);

    }
}
