package vacademy.io.admin_core_service.features.institute.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.institute.dto.settings.GenericSettingRequest;
import vacademy.io.admin_core_service.features.institute.dto.settings.InstituteSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.SettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.naming.NameSettingRequest;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.InstituteSettingService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.Optional;

@Component
public class InstituteSettingManager {

    @Autowired
    InstituteRepository instituteRepository;

    @Autowired
    InstituteSettingService instituteSettingService;

    public ResponseEntity<String> createNewNamingSetting(CustomUserDetails userDetails, String instituteId, NameSettingRequest request) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        instituteSettingService.createNewNamingSetting(institute.get(), request);
        return ResponseEntity.ok("Done");
    }

    public ResponseEntity<String> updateNamingSetting(CustomUserDetails userDetails, String instituteId, NameSettingRequest request) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        instituteSettingService.updateNamingSetting(institute.get(), request);
        return ResponseEntity.ok("Done");
    }

    // Generic methods for any setting type
    public ResponseEntity<String> createNewGenericSetting(CustomUserDetails userDetails, String instituteId, String settingKey, GenericSettingRequest request) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        instituteSettingService.createNewGenericSetting(institute.get(), settingKey, request.getSettingData());
        return ResponseEntity.ok("Done");
    }

    public ResponseEntity<String> updateGenericSetting(CustomUserDetails userDetails, String instituteId, String settingKey, GenericSettingRequest request) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        instituteSettingService.updateGenericSetting(institute.get(), settingKey, request.getSettingData());
        return ResponseEntity.ok("Done");
    }

    // Upsert method - creates if doesn't exist, updates if exists
    public ResponseEntity<String> saveGenericSetting(CustomUserDetails userDetails, String instituteId, String settingKey, GenericSettingRequest request) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        instituteSettingService.saveGenericSetting(institute.get(), settingKey, request);
        return ResponseEntity.ok("Setting saved successfully");
    }

    // GET methods for retrieving settings
    public ResponseEntity<InstituteSettingDto> getAllSettings(CustomUserDetails userDetails, String instituteId) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        InstituteSettingDto settings = instituteSettingService.getAllSettings(institute.get());
        return ResponseEntity.ok(settings);
    }

    public ResponseEntity<SettingDto> getSpecificSetting(CustomUserDetails userDetails, String instituteId, String settingKey) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        SettingDto setting = instituteSettingService.getSpecificSetting(institute.get(), settingKey);
        return ResponseEntity.ok(setting);
    }

    public ResponseEntity<Object> getSettingData(CustomUserDetails userDetails, String instituteId, String settingKey) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        Object settingData = instituteSettingService.getSettingData(institute.get(), settingKey);
        return ResponseEntity.ok(settingData);
    }

    public ResponseEntity<String> getSettingsAsRawJson(CustomUserDetails userDetails, String instituteId) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        String rawJson = instituteSettingService.getSettingsAsRawJson(institute.get());
        return ResponseEntity.ok(rawJson != null ? rawJson : "{}");
    }
}
