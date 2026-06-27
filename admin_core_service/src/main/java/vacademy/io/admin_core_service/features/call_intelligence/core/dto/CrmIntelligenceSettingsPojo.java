package vacademy.io.admin_core_service.features.call_intelligence.core.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Server-side mirror of the CRM_INTELLIGENCE_SETTING JSON the admin saves from the
 * "CRM Intelligence" settings tab. Read via {@code CrmIntelligenceSettingsService};
 * gates which calls get transcribed + analyzed and how the two ratings are scored.
 *
 * Phase 1 covers calls only; {@code messaging}/{@code email} sections will hang off
 * the same envelope later. Output data-point schema is fixed — only the rubric,
 * goal hint, thresholds and the per-institute credit price are tunable.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class CrmIntelligenceSettingsPojo {

    /** Master switch for the whole intelligence layer for this institute. */
    private boolean enabled = false;

    private Calls calls = new Calls();

    public static CrmIntelligenceSettingsPojo defaults() {
        return new CrmIntelligenceSettingsPojo();
    }

    /** True only when intelligence is on globally AND for calls. */
    public boolean callsEnabled() {
        return enabled && calls != null && calls.isEnabled();
    }

    /** Whether a given call source (MANUAL|TELEPHONY|AI) is enabled. Unknown → false. */
    public boolean sourceEnabled(String source) {
        if (calls == null || calls.getSources() == null || source == null) return false;
        return Boolean.TRUE.equals(calls.getSources().get(source.toUpperCase()));
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Calls {
        private boolean enabled = false;

        /**
         * Per-source toggles, keyed by ProviderType bucket: MANUAL | TELEPHONY | AI.
         * AI calls (Aavtaar) re-run our own pipeline for cross-source consistency,
         * so they obey this toggle too. Default: all on once calls are enabled.
         */
        private Map<String, Boolean> sources = defaultSources();

        /** Skip very short calls (voicemail blips) — no transcript value, no charge. */
        private int minDurationSeconds = 20;

        /** Analyze calls that never connected (no answer / busy). Usually no audio. */
        private boolean analyzeNotConnected = false;

        /**
         * Per-institute override of the credit price per analyzed call. {@code null}
         * = use the DB-managed global price (credit_pricing 'call_intelligence').
         */
        private BigDecimal creditCostOverride;

        /** Rating scale upper bound for both ratings (both default to 0-10). */
        private int ratingScale = 10;

        private Rubric rubric = new Rubric();

        private static Map<String, Boolean> defaultSources() {
            Map<String, Boolean> m = new LinkedHashMap<>();
            m.put("MANUAL", true);
            m.put("TELEPHONY", true);
            m.put("AI", true);
            return m;
        }
    }

    /**
     * Institute-tunable scoring guidance. The call objective is AI-inferred from the
     * transcript (objectiveHint is an optional nudge, not a requirement); the
     * qualities + weights steer the caller-self-goal rating breakdown.
     */
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Rubric {
        /** Optional hint to bias goal inference (e.g. "book a campus demo"). Null = pure inference. */
        private String objectiveHint;

        /** Quality dimensions scored within caller_self_goal_rating.qualities[]. */
        private List<String> qualities = List.of(
                "rapport", "needs_discovery", "objection_handling", "next_step_secured");

        /** Optional per-quality weights (sum need not be 1; normalized at scoring time). */
        private Map<String, BigDecimal> weights;
    }
}
