package vacademy.io.admin_core_service.features.audience.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;

import java.time.Duration;

/**
 * Per-institute lead deduplication settings, read from the {@code LEAD_SETTING}
 * blob the Settings UI saves:
 *
 * <pre>
 * institute.setting → setting → LEAD_SETTING → data → dedup → {
 *   "enabled": false,
 *   "field": "EMAIL" | "PHONE",
 *   "scope": "CAMPAIGN" | "INSTITUTE"
 * }
 * </pre>
 *
 * Cached 5 minutes per institute (same pattern as {@link LeadReportSettingService}).
 * Defensive parsing: a missing subtree or invalid enum value falls back to the
 * defaults below (dedup disabled), so a bad manual edit of the JSON can never
 * start silently rejecting leads.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LeadDedupSettingService {

    public enum DedupField { EMAIL, PHONE }

    public enum DedupScope { CAMPAIGN, INSTITUTE }

    public record DedupSettings(boolean enabled, DedupField field, DedupScope scope) {
    }

    public static final DedupSettings DEFAULTS = new DedupSettings(false, DedupField.EMAIL, DedupScope.CAMPAIGN);

    private final InstituteRepository instituteRepository;
    private final ObjectMapper objectMapper;

    private final Cache<String, DedupSettings> byInstituteId = Caffeine.newBuilder()
            .maximumSize(2000)
            .expireAfterWrite(Duration.ofMinutes(5))
            .build();

    /** Cached 5-min; defaults to disabled. */
    public DedupSettings get(String instituteId) {
        if (instituteId == null || instituteId.isBlank()) return DEFAULTS;
        return byInstituteId.get(instituteId, this::load);
    }

    private DedupSettings load(String instituteId) {
        try {
            String settingJson = instituteRepository.findById(instituteId)
                    .map(i -> i.getSetting())
                    .orElse(null);
            if (settingJson == null || settingJson.isBlank()) return DEFAULTS;

            JsonNode root = objectMapper.readTree(settingJson);
            JsonNode dedup = root.path("setting").path("LEAD_SETTING").path("data").path("dedup");
            if (!dedup.isObject()) return DEFAULTS;

            boolean enabled = dedup.path("enabled").asBoolean(false);
            DedupField field = parseField(dedup.path("field"), instituteId);
            DedupScope scope = parseScope(dedup.path("scope"), instituteId);

            return new DedupSettings(enabled, field, scope);
        } catch (Exception e) {
            log.warn("Failed to read lead dedup settings for institute {} — using defaults: {}",
                    instituteId, e.getMessage());
            return DEFAULTS;
        }
    }

    private DedupField parseField(JsonNode node, String instituteId) {
        if (!node.isTextual()) return DEFAULTS.field();
        try {
            return DedupField.valueOf(node.asText().trim().toUpperCase());
        } catch (Exception e) {
            log.warn("Invalid dedup field '{}' for institute {} — using default {}",
                    node.asText(), instituteId, DEFAULTS.field());
            return DEFAULTS.field();
        }
    }

    private DedupScope parseScope(JsonNode node, String instituteId) {
        if (!node.isTextual()) return DEFAULTS.scope();
        try {
            return DedupScope.valueOf(node.asText().trim().toUpperCase());
        } catch (Exception e) {
            log.warn("Invalid dedup scope '{}' for institute {} — using default {}",
                    node.asText(), instituteId, DEFAULTS.scope());
            return DEFAULTS.scope();
        }
    }
}
