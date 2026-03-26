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

    /**
     * Returns the max number of active concurrent sessions allowed for the
     * institute.
     * Returns 0 if the institute has NOT configured a limit (0 = unlimited).
     * Fully backward-compatible: institutes without this setting are unaffected.
     */
    @Transactional(readOnly = true)
    public int getMaxActiveSessions(String instituteId) {
        if (instituteId == null)
            return 0;
        return instituteSettingsRepository.findByInstituteId(instituteId)
                .map(settings -> {
                    String json = settings.getSettingsJson();
                    if (json == null || json.isBlank() || "{}".equals(json.trim()))
                        return 0;
                    try {
                        // Manual JSON parsing — no extra Jackson dependency needed
                        // Looks for "max_active_sessions": <number>
                        int idx = json.indexOf("\"max_active_sessions\"");
                        if (idx == -1)
                            return 0;
                        int colonIdx = json.indexOf(':', idx);
                        if (colonIdx == -1)
                            return 0;
                        String rest = json.substring(colonIdx + 1).trim();
                        StringBuilder digits = new StringBuilder();
                        for (char c : rest.toCharArray()) {
                            if (Character.isDigit(c))
                                digits.append(c);
                            else if (!digits.isEmpty())
                                break;
                        }
                        return digits.isEmpty() ? 0 : Integer.parseInt(digits.toString());
                    } catch (Exception e) {
                        log.warn("Failed to parse max_active_sessions from settings_json for institute {}: {}",
                                instituteId, e.getMessage());
                        return 0;
                    }
                }).orElse(0);
    }

    /**
     * Writes max_active_sessions into the settings_json for an institute.
     * Called by the internal sync endpoint from admin_core_service.
     * Preserves any other keys already in settings_json.
     */
    @Transactional
    public void updateMaxActiveSessions(String instituteId, int maxSessions) {
        InstituteSettings settings = instituteSettingsRepository.findByInstituteId(instituteId)
                .orElse(InstituteSettings.builder()
                        .instituteId(instituteId)
                        .userIdentifier("EMAIL")
                        .settingsJson("{}")
                        .build());

        String existing = settings.getSettingsJson();
        if (existing == null || existing.isBlank())
            existing = "{}";

        // Update or insert max_active_sessions key
        String updated;
        if (existing.contains("\"max_active_sessions\"")) {
            updated = existing.replaceAll("\"max_active_sessions\"\\s*:\\s*\\d+",
                    "\"max_active_sessions\": " + maxSessions);
        } else {
            if ("{}".equals(existing.trim())) {
                updated = "{\"max_active_sessions\": " + maxSessions + "}";
            } else {
                updated = existing.trim();
                updated = updated.substring(0, updated.length() - 1)
                        + ", \"max_active_sessions\": " + maxSessions + "}";
            }
        }
        settings.setSettingsJson(updated);
        instituteSettingsRepository.save(settings);
        log.info("Updated max_active_sessions to {} for institute {}", maxSessions, instituteId);
    }
}
