package vacademy.io.auth_service.feature.institute.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.auth_service.feature.institute.dto.UpdateInstituteSettingsDTO;
import vacademy.io.auth_service.feature.institute.entity.InstituteSettings;
import vacademy.io.auth_service.feature.institute.repository.InstituteSettingsRepository;

import java.util.Optional;

@Service
public class InstituteSettingsService {

    private static final Logger log = LoggerFactory.getLogger(InstituteSettingsService.class);

    @Autowired
    private InstituteSettingsRepository instituteSettingsRepository;

    @Transactional
    public void updateInstituteSettings(UpdateInstituteSettingsDTO updateDTO) {
        log.info("Updating institute settings for instituteId: {}", updateDTO.getInstituteId());
        Optional<InstituteSettings> settingsOpt = instituteSettingsRepository
                .findByInstituteId(updateDTO.getInstituteId());

        if (settingsOpt.isPresent()) {
            InstituteSettings settings = settingsOpt.get();
            if (updateDTO.getUserIdentifier() != null) {
                settings.setUserIdentifier(updateDTO.getUserIdentifier());
            }
            if (updateDTO.getSettingsJson() != null) {
                settings.setSettingsJson(updateDTO.getSettingsJson());
            }
            instituteSettingsRepository.save(settings);
        } else {
            InstituteSettings newSettings = InstituteSettings.builder()
                    .instituteId(updateDTO.getInstituteId())
                    .userIdentifier(updateDTO.getUserIdentifier() != null ? updateDTO.getUserIdentifier() : "EMAIL")
                    .settingsJson(updateDTO.getSettingsJson() != null ? updateDTO.getSettingsJson() : "{}")
                    .build();
            instituteSettingsRepository.save(newSettings);
        }
    }

    @Transactional(readOnly = true)
    public String getUserIdentifier(String instituteId) {
        if (instituteId == null) {
            return "EMAIL";
        }
        return instituteSettingsRepository.findByInstituteId(instituteId)
                .map(InstituteSettings::getUserIdentifier)
                .orElse("EMAIL");
    }
}
