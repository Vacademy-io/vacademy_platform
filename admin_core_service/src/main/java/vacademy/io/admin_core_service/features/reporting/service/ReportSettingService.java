package vacademy.io.admin_core_service.features.reporting.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.reporting.dto.ReportScheduleConfig;
import vacademy.io.admin_core_service.features.reporting.dto.ReportSettingConfig;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reads REPORT_SETTING out of {@code institutes.setting_json}.
 *
 * Storage rides on the existing generic settings mechanism — one new key in
 * {@code SettingKeyEnums} and the standard save/get endpoints handle CRUD, so
 * there is no bespoke config table or controller to maintain.
 *
 * Every parse is individually guarded. At least one institute's settings blob is
 * not valid JSON, and the failure mode of a shared nightly job must be "that one
 * institute is skipped", never "nobody gets a report".
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ReportSettingService {

    public static final String SETTING_KEY = "REPORT_SETTING";

    private final InstituteRepository instituteRepository;
    private final ObjectMapper objectMapper;

    /** Institute id → parsed config, for every institute with reporting switched on. */
    public Map<String, ReportSettingConfig> loadEnabledConfigs() {
        Map<String, ReportSettingConfig> out = new LinkedHashMap<>();

        for (Object[] row : instituteRepository.findIdAndSettingJsonWithReportSetting()) {
            String instituteId = (String) row[0];
            String settingJson = (String) row[1];
            if (settingJson == null || settingJson.isBlank()) continue;

            try {
                JsonNode data = objectMapper.readTree(settingJson)
                        .path("setting")
                        .path(SETTING_KEY)
                        .path("data");
                if (data.isMissingNode() || data.isNull()) continue;

                ReportSettingConfig cfg = objectMapper.treeToValue(data, ReportSettingConfig.class);
                if (cfg == null || !cfg.isEnabled()) continue;

                List<ReportScheduleConfig> live = new ArrayList<>();
                for (ReportScheduleConfig s : cfg.getSchedules()) {
                    if (s == null || !s.isEnabled()) continue;
                    if (s.getId() == null || s.getId().isBlank()) {
                        // Without a stable id there is no idempotency key, so a run
                        // could be sent twice. Refuse rather than risk it.
                        log.warn("[reporting] institute {} has a schedule with no id — skipped", instituteId);
                        continue;
                    }
                    if (s.getSections() == null || s.getSections().isEmpty()) continue;
                    live.add(s);
                }
                if (live.isEmpty()) continue;

                cfg.setSchedules(live);
                out.put(instituteId, cfg);

            } catch (Exception e) {
                log.warn("[reporting] could not parse REPORT_SETTING for institute {} — skipping it", instituteId, e);
            }
        }
        return out;
    }
}
