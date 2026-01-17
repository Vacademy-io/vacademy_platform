package vacademy.io.admin_core_service.features.institute.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute.dto.settings.GenericSettingRequest;
import vacademy.io.admin_core_service.features.institute.dto.settings.InstituteSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.SettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.naming.NameSettingRequest;
import vacademy.io.admin_core_service.features.institute.manager.InstituteSettingManager;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/institute/setting/v1")
public class InstituteSettingController {

    @Autowired
    InstituteSettingManager instituteSettingManager;

    // ========================= SAVE/UPDATE ENDPOINTS =========================
    
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

    // Unified API for any setting key - handles both create and update
    // Supports: NAME_SETTING, COURSE_SETTING, CERTIFICATE_SETTING, CHATBOT_SETTING, etc.
    @PostMapping("/save-setting")
    public ResponseEntity<String> saveSetting(@RequestAttribute("user")CustomUserDetails userDetails,
                                              @RequestParam("instituteId") String instituteId,
                                              @RequestParam("settingKey") String settingKey,
                                              @RequestBody GenericSettingRequest request){
        return instituteSettingManager.saveGenericSetting(userDetails, instituteId, settingKey, request);
    }

    // ========================= GET ENDPOINTS =========================

    // Get all settings for an institute
    @GetMapping("/all")
    public ResponseEntity<InstituteSettingDto> getAllSettings(@RequestAttribute("user")CustomUserDetails userDetails,
                                                             @RequestParam("instituteId") String instituteId){
        return instituteSettingManager.getAllSettings(userDetails, instituteId);
    }

    // Get a specific setting by key
    @GetMapping("/get")
    public ResponseEntity<SettingDto> getSpecificSetting(@RequestAttribute("user")CustomUserDetails userDetails,
                                                         @RequestParam("instituteId") String instituteId,
                                                         @RequestParam("settingKey") String settingKey){
        return instituteSettingManager.getSpecificSetting(userDetails, instituteId, settingKey);
    }

    // Get only the data part of a specific setting
    @GetMapping("/data")
    public ResponseEntity<Object> getSettingData(@RequestAttribute("user")CustomUserDetails userDetails,
                                                 @RequestParam("instituteId") String instituteId,
                                                 @RequestParam("settingKey") String settingKey){
        return instituteSettingManager.getSettingData(userDetails, instituteId, settingKey);
    }

    // Get raw JSON string (for backward compatibility)
    @GetMapping("/raw")
    public ResponseEntity<String> getSettingsAsRawJson(@RequestAttribute("user")CustomUserDetails userDetails,
                                                       @RequestParam("instituteId") String instituteId){
        return instituteSettingManager.getSettingsAsRawJson(userDetails, instituteId);
    }

}
