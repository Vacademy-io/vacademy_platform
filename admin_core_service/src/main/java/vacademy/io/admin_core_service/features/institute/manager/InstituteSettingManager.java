package vacademy.io.admin_core_service.features.institute.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
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
}
