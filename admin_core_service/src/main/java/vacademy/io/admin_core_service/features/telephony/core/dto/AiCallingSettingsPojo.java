package vacademy.io.admin_core_service.features.telephony.core.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

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
    private int connectThresholdSec = 20;

    /**
     * Show the manual "AI call" button in lead lists. Independent of {@link #enabled}:
     * turning this off only hides the icon — AI workflows keep running.
     */
    private boolean showInLeadList = false;

    private int maxRetries = 3;
    private int maxCallsPerDayPerLead = 3;

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

    /** A single calling window. {@code start}/{@code end} are "HH:mm" (24h). */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Shift {
        private String start;
        private String end;
    }
}
