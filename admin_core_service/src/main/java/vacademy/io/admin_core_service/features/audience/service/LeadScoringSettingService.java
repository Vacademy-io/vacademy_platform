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
 * Per-institute lead-scoring config, read from the {@code LEAD_SETTING} blob
 * the Settings → Lead Settings → Config tab saves:
 *
 * <pre>
 * institute.setting → setting → LEAD_SETTING → data → {
 *   "scoringWeights": {
 *     "sourceQuality": 25, "profileCompleteness": 30,
 *     "recency": 25, "engagement": 20        // must sum to 100
 *   },
 *   "recencyDecayDays": 30
 * }
 * </pre>
 *
 * Scoring runs on every lead submission and lead event, so reads go through a
 * 5-minute Caffeine cache (same pattern as TelephonyConfigCache) instead of
 * hitting the institute row each time. There is no evict hook on the generic
 * save-setting endpoint — a weight change takes effect within 5 minutes, which
 * matches the frontend's own 5-minute staleTime on this setting; the
 * per-campaign "Recalculate scores" action picks it up immediately after that.
 *
 * Invalid configs (negative weights, sum ≠ 100, non-numeric) fall back to the
 * defaults below so a bad manual edit of the JSON can never skew live scoring.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LeadScoringSettingService {

    /** Effective weights + recency decay window for one institute. */
    public record ScoringConfig(int sourceWeight, int completenessWeight,
                                int recencyWeight, int engagementWeight,
                                int decayDays) {
    }

    public static final ScoringConfig DEFAULTS = new ScoringConfig(25, 30, 25, 20, 30);

    private static final int MIN_DECAY_DAYS = 1;
    private static final int MAX_DECAY_DAYS = 365;

    private final InstituteRepository instituteRepository;
    private final ObjectMapper objectMapper;

    private final Cache<String, ScoringConfig> byInstituteId = Caffeine.newBuilder()
            .maximumSize(2000)
            .expireAfterWrite(Duration.ofMinutes(5))
            .build();

    public ScoringConfig get(String instituteId) {
        if (instituteId == null || instituteId.isBlank()) return DEFAULTS;
        return byInstituteId.get(instituteId, this::load);
    }

    private ScoringConfig load(String instituteId) {
        try {
            String settingJson = instituteRepository.findById(instituteId)
                    .map(i -> i.getSetting())
                    .orElse(null);
            if (settingJson == null || settingJson.isBlank()) return DEFAULTS;

            JsonNode root = objectMapper.readTree(settingJson);
            JsonNode data = root.path("setting").path("LEAD_SETTING").path("data");
            if (!data.isObject()) return DEFAULTS;

            // Missing individual weight keys inherit the default — mirrors how the
            // frontend merges a partial saved config before validating the sum.
            JsonNode weights = data.path("scoringWeights");
            int source       = intOrDefault(weights, "sourceQuality",       DEFAULTS.sourceWeight());
            int completeness = intOrDefault(weights, "profileCompleteness", DEFAULTS.completenessWeight());
            int recency      = intOrDefault(weights, "recency",             DEFAULTS.recencyWeight());
            int engagement   = intOrDefault(weights, "engagement",          DEFAULTS.engagementWeight());

            if (source < 0 || completeness < 0 || recency < 0 || engagement < 0
                    || source + completeness + recency + engagement != 100) {
                log.warn("Invalid scoringWeights for institute {} (sum must be 100, all >= 0): " +
                                "source={}, completeness={}, recency={}, engagement={} — using defaults",
                        instituteId, source, completeness, recency, engagement);
                source = DEFAULTS.sourceWeight();
                completeness = DEFAULTS.completenessWeight();
                recency = DEFAULTS.recencyWeight();
                engagement = DEFAULTS.engagementWeight();
            }

            int decayDays = intOrDefault(data, "recencyDecayDays", DEFAULTS.decayDays());
            if (decayDays < MIN_DECAY_DAYS || decayDays > MAX_DECAY_DAYS) {
                log.warn("Invalid recencyDecayDays={} for institute {} — using default {}",
                        decayDays, instituteId, DEFAULTS.decayDays());
                decayDays = DEFAULTS.decayDays();
            }

            return new ScoringConfig(source, completeness, recency, engagement, decayDays);
        } catch (Exception e) {
            log.warn("Failed to read lead scoring config for institute {} — using defaults: {}",
                    instituteId, e.getMessage());
            return DEFAULTS;
        }
    }

    private int intOrDefault(JsonNode parent, String field, int fallback) {
        JsonNode n = parent.path(field);
        return n.isNumber() ? n.asInt() : fallback;
    }
}
