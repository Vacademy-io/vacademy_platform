package vacademy.io.admin_core_service.features.institute.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute.dto.settings.naming.NameSettingRequest;
import vacademy.io.admin_core_service.features.institute.manager.InstituteSettingManager;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/institute/setting/v1")
public class InstituteSettingController {

    @Autowired
    InstituteSettingManager instituteSettingManager;

    @PostMapping("/create-name-setting")
    public ResponseEntity<String> newNamingSetting(@RequestAttribute("user")CustomUserDetails userDetails,
                                                   @RequestParam("instituteId") String instituteId,
                                                   @RequestBody NameSettingRequest request){
        return instituteSettingManager.createNewNamingSetting(userDetails, instituteId, request);
    }

    @PostMapping("/update-name-setting")
    public ResponseEntity<String> updateNamingSetting(@RequestAttribute("user")CustomUserDetails userDetails,
                                                   @RequestParam("instituteId") String instituteId,
                                                   @RequestBody NameSettingRequest request){
        return instituteSettingManager.updateNamingSetting(userDetails, instituteId, request);
    }
}
