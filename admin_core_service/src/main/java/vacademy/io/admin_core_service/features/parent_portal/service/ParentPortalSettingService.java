package vacademy.io.admin_core_service.features.parent_portal.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.parent_portal.dto.ParentPortalSettingsDTO;
import vacademy.io.common.exceptions.ForbiddenException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Reads and enforces {@code PARENT_SETTING.data.parentPortal}.
 *
 * <p>Server-side authorization for the parent portal: the master {@code enabled}
 * gate, per-module visibility, and the view-as-child gate. Every BFF handler
 * consults this — the modules are access boundaries, not UI hints.
 *
 * <p>Default-deny for {@code enabled} (parse failure ⇒ off); default-allow
 * per-module once the portal is enabled (matching the frontend defaults, except
 * payments which defaults off).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ParentPortalSettingService {

    /** module keys -> default visibility when the portal is enabled but the map is absent. */
    private static final Map<String, Boolean> DEFAULT_MODULES = defaultModules();

    private final InstituteRepository instituteRepository;
    private final ObjectMapper objectMapper;

    @Cacheable(value = "parentPortalSettings", key = "#instituteId")
    public ParentPortalSettingsDTO getSettings(String instituteId) {
        ParentPortalSettingsDTO defaults = ParentPortalSettingsDTO.builder()
                .enabled(false)
                .modules(new LinkedHashMap<>(DEFAULT_MODULES))
                .reportAccess("COMPLETED_ONLY")
                .allowViewAsChild(false)
                .allowSwitchToParentView(true)
                .build();
        try {
            String settingJson = instituteRepository.findById(instituteId)
                    .map(institute -> institute.getSetting())
                    .orElse(null);
            if (!StringUtils.hasText(settingJson)) {
                return defaults;
            }
            JsonNode pp = objectMapper.readTree(settingJson)
                    .path("setting").path("PARENT_SETTING").path("data").path("parentPortal");
            if (pp.isMissingNode() || pp.isNull()) {
                return defaults;
            }

            Map<String, Boolean> modules = new LinkedHashMap<>(DEFAULT_MODULES);
            JsonNode modulesNode = pp.path("modules");
            if (modulesNode.isObject()) {
                for (String key : DEFAULT_MODULES.keySet()) {
                    JsonNode m = modulesNode.path(key);
                    if (m.isObject() && m.has("visible")) {
                        modules.put(key, m.path("visible").asBoolean(DEFAULT_MODULES.get(key)));
                    }
                }
            }

            return ParentPortalSettingsDTO.builder()
                    .enabled(pp.path("enabled").asBoolean(false))
                    .modules(modules)
                    .reportAccess(pp.path("reportAccess").asText("COMPLETED_ONLY"))
                    .allowViewAsChild(pp.path("allowViewAsChild").asBoolean(false))
                    .allowSwitchToParentView(pp.path("allowSwitchToParentView").asBoolean(true))
                    .build();
        } catch (Exception e) {
            log.warn("Could not read parentPortal settings for institute {}: {}", instituteId, e.getMessage());
            return defaults; // default-deny: enabled=false
        }
    }

    /** Throws 403 unless the portal is enabled for the institute. */
    public ParentPortalSettingsDTO requireEnabled(String instituteId) {
        ParentPortalSettingsDTO settings = getSettings(instituteId);
        if (!settings.isEnabled()) {
            throw new ForbiddenException("Parent portal is not enabled for this institute");
        }
        return settings;
    }

    /** Throws 403 unless the portal is enabled AND the given module is visible. */
    public void requireModule(String instituteId, String moduleKey) {
        ParentPortalSettingsDTO settings = requireEnabled(instituteId);
        Map<String, Boolean> modules = settings.getModules();
        boolean visible = modules != null && Boolean.TRUE.equals(modules.get(moduleKey));
        if (!visible) {
            throw new ForbiddenException("Module '" + moduleKey + "' is not available for this institute");
        }
    }

    private static Map<String, Boolean> defaultModules() {
        Map<String, Boolean> m = new LinkedHashMap<>();
        m.put("overview", true);
        m.put("attendance", true);
        m.put("liveSessions", true);
        m.put("assessments", true);
        m.put("progress", true);
        m.put("payments", false); // highest-sensitivity — opt-in
        m.put("badges", true);
        m.put("certificates", true);
        m.put("reports", true);
        return m;
    }
}
