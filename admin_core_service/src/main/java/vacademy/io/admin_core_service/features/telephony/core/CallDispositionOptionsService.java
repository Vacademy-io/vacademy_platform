package vacademy.io.admin_core_service.features.telephony.core;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallingSettingsPojo;
import vacademy.io.admin_core_service.features.telephony.core.dto.CallDispositionCatalogDTO;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AiAgent;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.CallDispositionCatalog;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.AiAgentRepository;

import java.sql.Types;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The Call Log's disposition FILTER vocabulary.
 *
 * <p>A call's outcome has two independent origins, and the dashboard shows both in
 * one column ({@code disposition_key} if a counsellor set one, else the AI's
 * {@code ai_call_result.disposition}):
 * <ol>
 *   <li><b>Manual</b> — {@code call_disposition_catalog}, the per-institute set a
 *       counsellor may apply after a call ({@link CallDispositionService});</li>
 *   <li><b>AI</b> — a free string the voice agent returns. It is NOT drawn from the
 *       catalog: it comes from the institute's <b>AI Calling settings</b>
 *       (built-ins + custom outcomes + the assign/stop lists) and from the
 *       per-agent {@code ai_agent.dispositions} registry.</li>
 * </ol>
 *
 * <p>Offering only the catalog therefore made the filter unusable on AI-heavy
 * institutes — the values in the column simply weren't in the dropdown. This
 * service merges every origin (plus what the institute's calls have actually
 * returned, so an outcome never goes missing because a setting drifted) into one
 * de-duplicated list.
 *
 * <p>De-duplication and the matching in {@code CallSearchService} both key on
 * {@link #normalizeKey}: {@code NOT_INTERESTED} (catalog), {@code Not_Interested}
 * (AI settings) and {@code "Not Interested"} (a hand-typed agent value) are ONE
 * outcome, and selecting it must match calls of all three spellings.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CallDispositionOptionsService {

    private final CallDispositionService callDispositionService;
    private final AiCallingSettingsService aiCallingSettingsService;
    private final AiAgentRepository aiAgentRepository;
    private final NamedParameterJdbcTemplate jdbc;

    private final ObjectMapper mapper = new ObjectMapper();

    /** How far back the "outcomes this institute's calls actually returned" probe looks. */
    private static final int OBSERVED_LOOKBACK_DAYS = 180;
    /** Backstop so a garbage-emitting agent can never balloon the dropdown. */
    private static final int MAX_OPTIONS = 200;

    private static final String OBSERVED_SQL = """
            SELECT DISTINCT acr.disposition
            FROM ai_call_result acr
            JOIN telephony_call_log tcl ON tcl.id = acr.call_log_id
            WHERE tcl.institute_id = :instituteId
              AND COALESCE(tcl.start_time, tcl.created_at) >= :since
              AND acr.disposition IS NOT NULL
              AND acr.disposition <> ''
            LIMIT :cap
            """;

    /**
     * Alphanumerics only, upper-cased — the join key between a catalog code, an AI
     * disposition string and a filter selection. {@code "Not_Interested"},
     * {@code "NOT_INTERESTED"} and {@code "not interested"} all collapse to
     * {@code NOTINTERESTED}. Blank in ⇒ blank out (callers drop those).
     */
    public static String normalizeKey(String raw) {
        return raw == null ? "" : raw.replaceAll("[^A-Za-z0-9]", "").toUpperCase();
    }

    /**
     * Every outcome the Disposition filter should offer, catalog first (settable, in
     * the institute's display order), then the configured AI vocabulary, then
     * whatever the calls themselves came back with.
     */
    public List<CallDispositionCatalogDTO> filterOptions(String instituteId) {
        Map<String, CallDispositionCatalogDTO> byKey = new LinkedHashMap<>();

        // 1 — the settable catalog. Read-only on purpose: the picker's own request
        // (which the Call Log fires in the same tick) owns the lazy seed.
        for (CallDispositionCatalog c : callDispositionService.listForInstituteWithoutSeeding(instituteId)) {
            String key = normalizeKey(c.getDispositionKey());
            if (key.isEmpty()) continue;
            byKey.putIfAbsent(key, CallDispositionCatalogDTO.from(c));
        }

        // 2 — what the institute configured in Settings → AI Calling.
        for (String d : configuredDispositions(instituteId)) {
            put(byKey, d, CallDispositionCatalogDTO.SOURCE_AI_SETTINGS);
        }

        // 3 — outcomes the institute's own AI agents declare.
        for (String d : agentDispositions(instituteId)) {
            put(byKey, d, CallDispositionCatalogDTO.SOURCE_AI_AGENT);
        }

        // 4 — outcomes the calls actually returned. Best-effort: this is a
        // completeness net (an agent renamed an outcome, a legacy value predates the
        // registry), never a reason to fail the dropdown.
        for (String d : observedDispositions(instituteId)) {
            put(byKey, d, CallDispositionCatalogDTO.SOURCE_OBSERVED);
        }

        List<CallDispositionCatalogDTO> out = List.copyOf(byKey.values());
        if (out.size() <= MAX_OPTIONS) return out;
        // Never truncate silently — a filter that quietly drops outcomes reads to the
        // user exactly like the bug this endpoint exists to fix.
        log.warn("[CallDispositionOptions] institute {} has {} distinct outcomes; offering the first {}",
                instituteId, out.size(), MAX_OPTIONS);
        return out.subList(0, MAX_OPTIONS);
    }

    private void put(Map<String, CallDispositionCatalogDTO> byKey, String raw, String source) {
        String key = normalizeKey(raw);
        if (key.isEmpty() || byKey.containsKey(key)) return;
        String value = raw.trim();
        byKey.put(key, CallDispositionCatalogDTO.builder()
                .id(source.toLowerCase() + ":" + key)
                .dispositionKey(value)
                .label(humanize(value))
                .color(null)
                .category("OTHER")
                .mapsToLeadStatus(false)
                // AI outcomes are reported BY the agent; a counsellor can't apply one
                // by hand (applyDisposition validates against the catalog), so the
                // picker must skip them while the filter keeps them.
                .settable(false)
                .source(source)
                .build());
    }

    /**
     * The institute's configured AI outcomes, or none if its settings can't be read.
     *
     * <p>Guarded locally rather than inside {@link AiCallingSettingsService}: reading
     * an institute whose whole {@code setting_json} is malformed throws (one such
     * institute exists in prod), and the call-placing paths are right to fail loudly
     * on that — but a filter dropdown is not. Every source here is individually
     * fallible and individually contained; none of them may empty the dropdown.
     */
    private List<String> configuredDispositions(String instituteId) {
        try {
            AiCallingSettingsPojo settings = aiCallingSettingsService.get(instituteId);
            return settings == null ? List.of() : settings.configuredDispositions();
        } catch (Exception e) {
            log.warn("[CallDispositionOptions] AI_CALLING_SETTING read failed for institute {}: {}",
                    instituteId, e.getMessage());
            return List.of();
        }
    }

    /** Parsed {@code ai_agent.dispositions} (a JSON string array) across the institute's agents. */
    private List<String> agentDispositions(String instituteId) {
        try {
            return aiAgentRepository.findByInstituteIdOrderByCreatedAtDesc(instituteId).stream()
                    .map(AiAgent::getDispositions)
                    .filter(json -> json != null && !json.isBlank())
                    .flatMap(json -> parseList(json).stream())
                    .toList();
        } catch (Exception e) {
            log.warn("[CallDispositionOptions] agent disposition read failed for institute {}: {}",
                    instituteId, e.getMessage());
            return List.of();
        }
    }

    private List<String> parseList(String json) {
        try {
            List<String> parsed = mapper.readValue(json, new TypeReference<List<String>>() {
            });
            return parsed == null ? List.of() : parsed;
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<String> observedDispositions(String instituteId) {
        try {
            MapSqlParameterSource params = new MapSqlParameterSource()
                    .addValue("instituteId", instituteId)
                    .addValue("since",
                            LocalDateTime.now(ZoneOffset.UTC).minusDays(OBSERVED_LOOKBACK_DAYS), Types.TIMESTAMP)
                    .addValue("cap", MAX_OPTIONS);
            return jdbc.queryForList(OBSERVED_SQL, params, String.class);
        } catch (Exception e) {
            log.warn("[CallDispositionOptions] observed-disposition probe failed for institute {}: {}",
                    instituteId, e.getMessage());
            return List.of();
        }
    }

    /** {@code "Likely_Interested"} → {@code "Likely Interested"}; {@code "no_response"} → {@code "No Response"}. */
    private static String humanize(String raw) {
        StringBuilder out = new StringBuilder();
        for (String word : raw.replaceAll("[_\\-]+", " ").trim().split("\\s+")) {
            if (word.isEmpty()) continue;
            if (out.length() > 0) out.append(' ');
            out.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1).toLowerCase());
        }
        return out.length() == 0 ? raw : out.toString();
    }
}
