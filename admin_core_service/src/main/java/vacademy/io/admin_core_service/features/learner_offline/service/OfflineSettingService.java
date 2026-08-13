package vacademy.io.admin_core_service.features.learner_offline.service;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.dto.settings.GenericSettingRequest;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineAccessSettingsPojo;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

/**
 * Typed read/write accessor for the institute-wide {@code OFFLINE_ACCESS_SETTING}
 * (offline plan, Part A6). Mirrors VoiceCallingSettingsService's pattern: returns
 * safe defaults (feature off) when absent/unparseable so callers never NPE, and
 * layers on the existing GenericSettingStrategy envelope via InstituteSettingService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OfflineSettingService {

    private final InstituteRepository instituteRepository;
    private final InstituteSettingService instituteSettingService;

    private final ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    public OfflineAccessSettingsPojo get(String instituteId) {
        if (instituteId == null || instituteId.isBlank()) {
            return OfflineAccessSettingsPojo.defaults();
        }
        Institute institute = instituteRepository.findById(instituteId).orElse(null);
        if (institute == null) {
            return OfflineAccessSettingsPojo.defaults();
        }
        Object data = instituteSettingService.getSettingData(institute, SettingKeyEnums.OFFLINE_ACCESS_SETTING.name());
        if (data == null) {
            return OfflineAccessSettingsPojo.defaults();
        }
        try {
            OfflineAccessSettingsPojo pojo = mapper.convertValue(data, OfflineAccessSettingsPojo.class);
            return pojo == null ? OfflineAccessSettingsPojo.defaults() : pojo;
        } catch (Exception e) {
            log.warn("offline-access: could not parse OFFLINE_ACCESS_SETTING for institute {} — using defaults",
                    instituteId, e);
            return OfflineAccessSettingsPojo.defaults();
        }
    }

    public boolean isEnabled(String instituteId) {
        return get(instituteId).isEnabled();
    }

    /** Upsert the institute's OFFLINE_ACCESS_SETTING, validating bounds first. */
    public void save(String instituteId, OfflineAccessSettingsPojo pojo) {
        if (pojo == null) {
            pojo = OfflineAccessSettingsPojo.defaults();
        }
        validate(pojo);

        Institute institute = instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute not found"));
        GenericSettingRequest request = GenericSettingRequest.builder()
                .settingName("Offline Access")
                .settingData(pojo)
                .build();
        instituteSettingService.saveGenericSetting(
                institute, SettingKeyEnums.OFFLINE_ACCESS_SETTING.name(), request);
    }

    private void validate(OfflineAccessSettingsPojo pojo) {
        if (pojo.getRevalidationDays() < OfflineAccessSettingsPojo.MIN_REVALIDATION_DAYS
                || pojo.getRevalidationDays() > OfflineAccessSettingsPojo.MAX_REVALIDATION_DAYS) {
            throw new VacademyException("revalidationDays must be between "
                    + OfflineAccessSettingsPojo.MIN_REVALIDATION_DAYS + " and "
                    + OfflineAccessSettingsPojo.MAX_REVALIDATION_DAYS);
        }
        if (pojo.getMaxDevices() < OfflineAccessSettingsPojo.MIN_MAX_DEVICES
                || pojo.getMaxDevices() > OfflineAccessSettingsPojo.MAX_MAX_DEVICES) {
            throw new VacademyException("maxDevices must be between "
                    + OfflineAccessSettingsPojo.MIN_MAX_DEVICES + " and "
                    + OfflineAccessSettingsPojo.MAX_MAX_DEVICES);
        }
    }
}
