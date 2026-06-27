package vacademy.io.admin_core_service.features.call_intelligence.core;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.call_intelligence.core.dto.CrmIntelligenceSettingsPojo;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.common.institute.entity.Institute;

/**
 * Reads the institute's CRM_INTELLIGENCE_SETTING JSON and deserialises it to
 * {@link CrmIntelligenceSettingsPojo}. Returns sane defaults (everything off) when
 * the setting is absent or unparseable, so the pipeline never NPEs and an institute
 * that never configured intelligence simply gets no analysis.
 */
@Service
@RequiredArgsConstructor
public class CrmIntelligenceSettingsService {

    private static final Logger log = LoggerFactory.getLogger(CrmIntelligenceSettingsService.class);

    private final InstituteRepository instituteRepository;
    private final InstituteSettingService instituteSettingService;

    private final ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    public CrmIntelligenceSettingsPojo get(String instituteId) {
        if (instituteId == null || instituteId.isBlank()) return CrmIntelligenceSettingsPojo.defaults();
        Institute institute = instituteRepository.findById(instituteId).orElse(null);
        if (institute == null) return CrmIntelligenceSettingsPojo.defaults();

        Object data = instituteSettingService.getSettingData(institute, SettingKeyEnums.CRM_INTELLIGENCE_SETTING.name());
        if (data == null) return CrmIntelligenceSettingsPojo.defaults();
        try {
            CrmIntelligenceSettingsPojo pojo = mapper.convertValue(data, CrmIntelligenceSettingsPojo.class);
            return pojo == null ? CrmIntelligenceSettingsPojo.defaults() : pojo;
        } catch (Exception e) {
            log.warn("crm-intelligence: could not parse CRM_INTELLIGENCE_SETTING for institute {} — using defaults",
                    instituteId, e);
            return CrmIntelligenceSettingsPojo.defaults();
        }
    }
}
