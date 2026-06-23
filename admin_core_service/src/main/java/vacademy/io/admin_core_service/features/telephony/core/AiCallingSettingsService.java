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
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallingSettingsPojo;
import vacademy.io.common.institute.entity.Institute;

/**
 * Reads the institute's AI_CALLING_SETTING JSON (saved from the settings tab) and
 * deserialises it to {@link AiCallingSettingsPojo}. Returns sane defaults when the
 * setting is absent or unparseable, so callers never NPE.
 */
@Service
@RequiredArgsConstructor
public class AiCallingSettingsService {

    private static final Logger log = LoggerFactory.getLogger(AiCallingSettingsService.class);

    private final InstituteRepository instituteRepository;
    private final InstituteSettingService instituteSettingService;

    private final ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    public AiCallingSettingsPojo get(String instituteId) {
        if (instituteId == null || instituteId.isBlank()) return AiCallingSettingsPojo.defaults();
        Institute institute = instituteRepository.findById(instituteId).orElse(null);
        if (institute == null) return AiCallingSettingsPojo.defaults();

        Object data = instituteSettingService.getSettingData(institute, SettingKeyEnums.AI_CALLING_SETTING.name());
        if (data == null) return AiCallingSettingsPojo.defaults();
        try {
            AiCallingSettingsPojo pojo = mapper.convertValue(data, AiCallingSettingsPojo.class);
            return pojo == null ? AiCallingSettingsPojo.defaults() : pojo;
        } catch (Exception e) {
            log.warn("ai-calling: could not parse AI_CALLING_SETTING for institute {} — using defaults", instituteId, e);
            return AiCallingSettingsPojo.defaults();
        }
    }
}
