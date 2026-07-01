package vacademy.io.admin_core_service.features.telephony.core;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.telephony.core.dto.VoiceCallingSettingsPojo;
import vacademy.io.common.institute.entity.Institute;

/**
 * Reads the institute's VOICE_CALLING_SETTING JSON (the Vacademy Voice / Plivo
 * product flag + config) and deserialises it to {@link VoiceCallingSettingsPojo}.
 * Returns sane defaults (everything off) when absent or unparseable, so callers
 * never NPE. Mirrors {@link AiCallingSettingsService}.
 *
 * <p>{@link #isEnabled(String)} is the single feature-flag gate every Plivo path
 * checks; the existing Exotel/Airtel/Aavtaar flows never consult it.
 */
@Service
@RequiredArgsConstructor
public class VoiceCallingSettingsService {

    private static final Logger log = LoggerFactory.getLogger(VoiceCallingSettingsService.class);

    private final InstituteRepository instituteRepository;
    private final InstituteSettingService instituteSettingService;

    private final ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    public VoiceCallingSettingsPojo get(String instituteId) {
        if (instituteId == null || instituteId.isBlank()) return VoiceCallingSettingsPojo.defaults();
        Institute institute = instituteRepository.findById(instituteId).orElse(null);
        if (institute == null) return VoiceCallingSettingsPojo.defaults();

        Object data = instituteSettingService.getSettingData(institute, SettingKeyEnums.VOICE_CALLING_SETTING.name());
        if (data == null) return VoiceCallingSettingsPojo.defaults();
        try {
            VoiceCallingSettingsPojo pojo = mapper.convertValue(data, VoiceCallingSettingsPojo.class);
            return pojo == null ? VoiceCallingSettingsPojo.defaults() : pojo;
        } catch (Exception e) {
            log.warn("vacademy-voice: could not parse VOICE_CALLING_SETTING for institute {} — using defaults",
                    instituteId, e);
            return VoiceCallingSettingsPojo.defaults();
        }
    }

    /** The feature-flag gate for every Plivo / Vacademy Voice path. */
    public boolean isEnabled(String instituteId) {
        return get(instituteId).isEnabled();
    }

    /** Upsert the institute's VOICE_CALLING_SETTING envelope from the admin settings UI. */
    public void save(String instituteId, VoiceCallingSettingsPojo pojo) {
        Institute institute = instituteRepository.findById(instituteId)
                .orElseThrow(() -> new vacademy.io.common.exceptions.VacademyException("Institute not found"));
        instituteSettingService.saveGenericSetting(
                institute, SettingKeyEnums.VOICE_CALLING_SETTING.name(),
                pojo == null ? VoiceCallingSettingsPojo.defaults() : pojo);
    }
}
