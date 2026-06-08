package vacademy.io.admin_core_service.features.counsellor_workbench.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.counsellor_rating.dto.RatingDTO;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.math.BigDecimal;
import java.util.*;

/**
 * Per-institute counsellor workbench + rating configuration. Lives inside the
 * existing institute_setting JSON under LEAD_SETTING → workbench, so we do
 * not pay for new tables to hold a single row per institute.
 *
 * <h3>JSON shape under LEAD_SETTING.data</h3>
 * <pre>
 * {
 *   "workbench": {
 *     "leads_team_id": "&lt;organization_team.id or null&gt;",
 *     "rating": {
 *       "strategy_type": "STATIC" | "STRATEGY_BASED",
 *       "starting_rating": 0,
 *       "window_days": 90,
 *       "success_status_keys": ["CONVERTED"],
 *       "w_conversion": 0.6,
 *       "w_velocity": 0.4,
 *       "ideal_velocity_hours": 24,
 *       "worst_velocity_hours": 720,
 *       "min_sample_size": 5
 *     }
 *   }
 * }
 * </pre>
 *
 * Reads return {@link WorkbenchConfig} (defaults applied for missing fields);
 * writes upsert into the JSON blob. The institute_setting JSON is already the
 * single source of truth for all lead-related config (LEAD_SETTING, SLA,
 * scoring weights), so workbench fields slot in naturally.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LeadWorkbenchSettingService {

    private static final String LEAD_SETTING_KEY = "LEAD_SETTING";

    private final InstituteRepository instituteRepository;
    private final ObjectMapper objectMapper;

    // ────────────────────────────────────────────────────────────────
    // Read
    // ────────────────────────────────────────────────────────────────

    public WorkbenchConfig get(String instituteId) {
        Institute institute = getInstitute(instituteId);
        JsonNode workbench = locateWorkbenchNode(institute.getSetting());
        WorkbenchConfig cfg = WorkbenchConfig.withDefaults(instituteId);
        if (workbench == null || workbench.isMissingNode() || workbench.isNull()) {
            return cfg;
        }
        if (workbench.hasNonNull("leads_team_id")) {
            cfg.setLeadsTeamId(workbench.get("leads_team_id").asText());
        }
        JsonNode rating = workbench.path("rating");
        if (rating.isObject()) {
            if (rating.hasNonNull("strategy_type"))
                cfg.setStrategyType(rating.get("strategy_type").asText());
            if (rating.hasNonNull("starting_rating"))
                cfg.setStartingRating(BigDecimal.valueOf(rating.get("starting_rating").asDouble()));
            if (rating.hasNonNull("window_days"))
                cfg.setWindowDays(rating.get("window_days").asInt());
            if (rating.has("success_status_keys") && rating.get("success_status_keys").isArray()) {
                List<String> keys = new ArrayList<>();
                rating.get("success_status_keys").forEach(n -> keys.add(n.asText()));
                cfg.setSuccessStatusKeys(keys);
            }
            if (rating.hasNonNull("w_conversion"))
                cfg.setWConversion(BigDecimal.valueOf(rating.get("w_conversion").asDouble()));
            if (rating.hasNonNull("w_velocity"))
                cfg.setWVelocity(BigDecimal.valueOf(rating.get("w_velocity").asDouble()));
            if (rating.hasNonNull("ideal_velocity_hours"))
                cfg.setIdealVelocityHours(rating.get("ideal_velocity_hours").asInt());
            if (rating.hasNonNull("worst_velocity_hours"))
                cfg.setWorstVelocityHours(rating.get("worst_velocity_hours").asInt());
            if (rating.hasNonNull("min_sample_size"))
                cfg.setMinSampleSize(rating.get("min_sample_size").asInt());
        }
        return cfg;
    }

    public Optional<String> getLeadsTeamId(String instituteId) {
        return Optional.ofNullable(get(instituteId).getLeadsTeamId());
    }

    // ────────────────────────────────────────────────────────────────
    // Write
    // ────────────────────────────────────────────────────────────────

    @Transactional
    public WorkbenchConfig setLeadsTeam(String instituteId, String leadsTeamId) {
        Institute institute = getInstitute(instituteId);
        ObjectNode root = mutableRoot(institute.getSetting());
        ObjectNode workbench = ensureWorkbenchNode(root);
        if (leadsTeamId == null || leadsTeamId.isBlank()) {
            workbench.remove("leads_team_id");
        } else {
            workbench.put("leads_team_id", leadsTeamId);
        }
        persist(institute, root);
        return get(instituteId);
    }

    @Transactional
    public WorkbenchConfig upsertRatingStrategy(WorkbenchConfig req) {
        if (req.getInstituteId() == null) {
            throw new VacademyException("institute_id is required");
        }
        Institute institute = getInstitute(req.getInstituteId());
        ObjectNode root = mutableRoot(institute.getSetting());
        ObjectNode workbench = ensureWorkbenchNode(root);
        ObjectNode rating = workbench.has("rating") && workbench.get("rating").isObject()
                ? (ObjectNode) workbench.get("rating")
                : workbench.putObject("rating");

        if (req.getStrategyType() != null) rating.put("strategy_type", req.getStrategyType());
        if (req.getStartingRating() != null) rating.put("starting_rating", req.getStartingRating());
        if (req.getWindowDays() != null) rating.put("window_days", req.getWindowDays());
        if (req.getSuccessStatusKeys() != null) {
            var arr = rating.putArray("success_status_keys");
            req.getSuccessStatusKeys().forEach(arr::add);
        }
        if (req.getWConversion() != null) rating.put("w_conversion", req.getWConversion());
        if (req.getWVelocity() != null) rating.put("w_velocity", req.getWVelocity());
        if (req.getIdealVelocityHours() != null) rating.put("ideal_velocity_hours", req.getIdealVelocityHours());
        if (req.getWorstVelocityHours() != null) rating.put("worst_velocity_hours", req.getWorstVelocityHours());
        if (req.getMinSampleSize() != null) rating.put("min_sample_size", req.getMinSampleSize());

        persist(institute, root);
        return get(req.getInstituteId());
    }

    // ────────────────────────────────────────────────────────────────
    // Per-counsellor ratings cache — stored inside the same JSON, keyed
    // by counsellor user_id. Replaces what used to be a dedicated
    // counsellor_rating table. Strategy config lives under
    // workbench.rating; per-counsellor scores live under
    // workbench.counsellor_ratings.{userId}.
    // ────────────────────────────────────────────────────────────────

    /**
     * One counsellor's cached rating, or empty when unrated. Used by the
     * single-rating endpoint + by the leaderboard fallback when computing
     * default zeros.
     */
    public Optional<RatingDTO> getCounsellorRating(String instituteId, String counsellorUserId) {
        Institute institute = getInstitute(instituteId);
        JsonNode workbench = locateWorkbenchNode(institute.getSetting());
        if (workbench == null || workbench.isMissingNode() || workbench.isNull()) return Optional.empty();
        JsonNode ratings = workbench.path("counsellor_ratings");
        if (!ratings.isObject()) return Optional.empty();
        JsonNode entry = ratings.get(counsellorUserId);
        if (entry == null || !entry.isObject()) return Optional.empty();
        return Optional.ofNullable(nodeToRatingDTO(entry, instituteId, counsellorUserId));
    }

    /**
     * All cached ratings for an institute, keyed by counsellor user_id.
     * Used by the leaderboard + batch reads. The map is empty when no
     * ratings have been written yet (fresh institute).
     */
    public Map<String, RatingDTO> getAllCounsellorRatings(String instituteId) {
        Institute institute = getInstitute(instituteId);
        JsonNode workbench = locateWorkbenchNode(institute.getSetting());
        if (workbench == null || workbench.isMissingNode() || workbench.isNull()) return Collections.emptyMap();
        JsonNode ratings = workbench.path("counsellor_ratings");
        if (!ratings.isObject()) return Collections.emptyMap();
        Map<String, RatingDTO> out = new HashMap<>();
        ratings.fields().forEachRemaining(e -> {
            RatingDTO dto = nodeToRatingDTO(e.getValue(), instituteId, e.getKey());
            if (dto != null) out.put(e.getKey(), dto);
        });
        return out;
    }

    /**
     * Read several counsellor ratings at once. Returns only existing
     * entries; callers that want default-zero fallbacks should layer that
     * on top.
     */
    public Map<String, RatingDTO> getCounsellorRatingsBatch(String instituteId,
                                                            Collection<String> counsellorUserIds) {
        if (counsellorUserIds == null || counsellorUserIds.isEmpty()) return Collections.emptyMap();
        Map<String, RatingDTO> all = getAllCounsellorRatings(instituteId);
        Map<String, RatingDTO> out = new HashMap<>();
        for (String uid : counsellorUserIds) {
            RatingDTO r = all.get(uid);
            if (r != null) out.put(uid, r);
        }
        return out;
    }

    /**
     * Write/replace one counsellor's cached rating inside the JSON. Caller
     * is responsible for filling the snapshot (strategy_type, score,
     * components, last_computed_at, manual_override).
     */
    @Transactional
    public RatingDTO upsertCounsellorRating(String instituteId, String counsellorUserId, RatingDTO dto) {
        if (dto == null) throw new VacademyException("rating payload is required");
        Institute institute = getInstitute(instituteId);
        ObjectNode root = mutableRoot(institute.getSetting());
        ObjectNode workbench = ensureWorkbenchNode(root);
        ObjectNode ratings = workbench.has("counsellor_ratings") && workbench.get("counsellor_ratings").isObject()
                ? (ObjectNode) workbench.get("counsellor_ratings")
                : workbench.putObject("counsellor_ratings");

        // Stamp the identity fields so the entry round-trips correctly.
        dto.setInstituteId(instituteId);
        dto.setCounsellorUserId(counsellorUserId);
        ratings.set(counsellorUserId, objectMapper.valueToTree(dto));

        persist(institute, root);
        return dto;
    }

    /** Reverse of {@link #upsertCounsellorRating} — translate a JSON entry into the DTO. */
    private RatingDTO nodeToRatingDTO(JsonNode entry, String instituteId, String counsellorUserId) {
        try {
            RatingDTO dto = objectMapper.treeToValue(entry, RatingDTO.class);
            if (dto == null) return null;
            // Re-stamp the keys even if the JSON happens to be missing them
            // (defensive — older entries may not carry redundant ids).
            dto.setInstituteId(instituteId);
            dto.setCounsellorUserId(counsellorUserId);
            return dto;
        } catch (Exception e) {
            log.warn("Bad counsellor_rating JSON entry for {}: {}", counsellorUserId, e.getMessage());
            return null;
        }
    }

    // ────────────────────────────────────────────────────────────────
    // JSON helpers — same conventions as WhatsAppSettingService.
    // ────────────────────────────────────────────────────────────────

    private Institute getInstitute(String instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute not found: " + instituteId));
    }

    private ObjectNode mutableRoot(String settingJson) {
        if (settingJson == null || settingJson.isBlank()) return objectMapper.createObjectNode();
        try {
            JsonNode n = objectMapper.readTree(settingJson);
            return n.isObject() ? (ObjectNode) n : objectMapper.createObjectNode();
        } catch (JsonProcessingException e) {
            log.warn("Corrupted setting JSON, starting fresh: {}", e.getMessage());
            return objectMapper.createObjectNode();
        }
    }

    private ObjectNode ensureWorkbenchNode(ObjectNode root) {
        // Match the existing layout: settings live under root.setting.<KEY>.data
        ObjectNode settingsMap = root.has("setting") && root.get("setting").isObject()
                ? (ObjectNode) root.get("setting") : root.putObject("setting");
        ObjectNode leadSetting = settingsMap.has(LEAD_SETTING_KEY) && settingsMap.get(LEAD_SETTING_KEY).isObject()
                ? (ObjectNode) settingsMap.get(LEAD_SETTING_KEY)
                : settingsMap.putObject(LEAD_SETTING_KEY);
        ObjectNode data = leadSetting.has("data") && leadSetting.get("data").isObject()
                ? (ObjectNode) leadSetting.get("data") : leadSetting.putObject("data");
        return data.has("workbench") && data.get("workbench").isObject()
                ? (ObjectNode) data.get("workbench") : data.putObject("workbench");
    }

    private JsonNode locateWorkbenchNode(String settingJson) {
        if (settingJson == null || settingJson.isBlank()) return null;
        try {
            JsonNode root = objectMapper.readTree(settingJson);
            JsonNode settingsMap = root.has("setting") ? root.get("setting") : root;
            return settingsMap.path(LEAD_SETTING_KEY).path("data").path("workbench");
        } catch (JsonProcessingException e) {
            log.warn("Bad institute setting JSON: {}", e.getMessage());
            return null;
        }
    }

    private void persist(Institute institute, ObjectNode root) {
        try {
            institute.setSetting(objectMapper.writeValueAsString(root));
            instituteRepository.save(institute);
        } catch (JsonProcessingException e) {
            throw new VacademyException("Could not save institute settings: " + e.getMessage());
        }
    }
}
