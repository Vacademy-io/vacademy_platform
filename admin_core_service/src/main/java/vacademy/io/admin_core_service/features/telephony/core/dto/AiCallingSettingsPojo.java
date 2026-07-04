package vacademy.io.admin_core_service.features.telephony.core.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Server-side mirror of the AI_CALLING_SETTING JSON the admin saves from the
 * "AI Calling" settings tab. Read via {@code AiCallingSettingsService}; consumed
 * by the outcome classifier to decide assign-vs-retry.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiCallingSettingsPojo {

    private boolean enabled;
    /**
     * AI-voice provider for this institute (e.g. AAVTAAR). Drop in a different agent
     * by registering its SPI beans and setting this — no code change to the caller.
     */
    private String provider = "AAVTAAR";
    private String defaultCampaignId;

    /**
     * Campaign registry: every Aavtaar campaign id this institute uses, each tagged
     * INBOUND (the lead dialed our AI line) or OUTBOUND (we dialed the lead). An
     * incoming AI-call webhook is classified INBOUND when its {@code campaignId}
     * matches one tagged INBOUND here — that's how inbound calls are labelled (there's
     * no provider call id to correlate, so the lead is matched by phone instead). Also
     * lets the call/recording view map a campaignId back to a friendly campaign name.
     * Empty = no campaigns registered (every call stays outbound, current behaviour).
     */
    private List<CampaignConfig> campaigns = new ArrayList<>();

    private int connectThresholdSec = 20;

    /**
     * Show the manual "AI call" button in lead lists. Independent of {@link #enabled}:
     * turning this off only hides the icon — AI workflows keep running.
     */
    private boolean showInLeadList = false;

    private int maxRetries = 3;
    private int maxCallsPerDayPerLead = 3;

    /**
     * Hard ceiling on AI dials for the WHOLE institute in a rolling 24h window
     * (across every lead, campaign and click-to-call — all funnel through
     * {@code AiCallService.placeCall}). The cheapest runaway-spend guardrail: one
     * fat-fingered bulk campaign can otherwise place hundreds of calls, each
     * billing telephony + STT + LLM + TTS. 0 = fall back to the server-wide
     * default ({@code telephony.ai.max-calls-per-day-default}).
     */
    private int maxCallsPerDay = 0;

    /** Minutes the CALL_AI node waits before re-dialing a no-answer lead (per pause/resume cycle). */
    private int retryGapMinutes = 120;
    /** Minutes before re-checking a lead deferred for being outside its calling shift / at the day cap. */
    private int recheckMinutes = 30;

    /**
     * Time windows (institute timezone) the AI bot may (re)dial in — supports
     * multiple shifts (e.g. 09:00–13:00 and 16:00–20:00). Consumed by the timed
     * retry re-dialer; immediate new-lead/manual/bulk calls fire right away.
     */
    private List<Shift> callingShifts = List.of(new Shift("09:00", "21:00"));

    // Legacy single window — kept so older saved settings still deserialize; the UI
    // now edits callingShifts.
    private String windowStart = "09:00";
    private String windowEnd = "21:00";
    private String timezone = "Asia/Kolkata";

    /** Dispositions that mean "good response" → assign a counsellor. */
    private List<String> assignOnDispositions = List.of("Interested", "Likely_Interested");
    /** Dispositions that are terminal → set a status and stop (no retry, no assign). */
    private List<String> stopOnDispositions = List.of("Not_Interested");

    private String assignmentMode = "ROUND_ROBIN";
    private boolean assignExhaustedToHuman = true;

    public static AiCallingSettingsPojo defaults() {
        return new AiCallingSettingsPojo();
    }

    /**
     * Resolve the raw provider campaign id for a provider-agnostic agent name, from the
     * {@link #campaigns} registry. Preference order: an exact (name, provider) entry, then
     * a (name, any-provider) entry, then {@link #defaultCampaignId}. This is what lets a
     * workflow author pick a named agent and have it resolve to the right id for whichever
     * provider is active — no raw campaign id in the node.
     */
    public String resolveCampaignId(String provider, String agentName) {
        if (agentName != null && !agentName.isBlank() && campaigns != null) {
            String byProvider = null, byAny = null;
            String wanted = agentName.trim();
            for (CampaignConfig c : campaigns) {
                if (c == null || c.getCampaignId() == null || c.getCampaignId().isBlank()) continue;
                if (c.getName() == null || !c.getName().equalsIgnoreCase(wanted)) continue;
                if (provider != null && provider.equalsIgnoreCase(c.getProvider())) {
                    byProvider = c.getCampaignId();
                } else if (c.getProvider() == null || c.getProvider().isBlank()) {
                    byAny = c.getCampaignId();
                }
            }
            if (byProvider != null) return byProvider;
            if (byAny != null) return byAny;
        }
        return defaultCampaignId;
    }

    /** A single calling window. {@code start}/{@code end} are "HH:mm" (24h). */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Shift {
        private String start;
        private String end;
    }

    /**
     * One configured AI campaign and its direction. {@code name} is the
     * provider-agnostic "agent" a workflow author picks (e.g. "Class Feedback");
     * {@code campaignId} is the raw id THIS {@code provider} uses for that agent;
     * {@code direction} is "INBOUND" / "OUTBOUND" (case-insensitive). The same
     * {@code name} can appear once per provider, so switching provider resolves the
     * same named agent to the right campaign id — that's how a call stays
     * provider-agnostic. {@code provider} blank ⇒ applies to any provider.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CampaignConfig {
        private String campaignId;
        private String name;
        private String direction;
        /** Which provider this campaign id belongs to (e.g. AAVTAAR). Blank ⇒ any provider. */
        private String provider;
    }
}
