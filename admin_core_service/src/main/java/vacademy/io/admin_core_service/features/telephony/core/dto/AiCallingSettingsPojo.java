package vacademy.io.admin_core_service.features.telephony.core.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

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
    private String defaultCampaignId;
    private int connectThresholdSec = 20;

    private int maxRetries = 3;
    private int maxCallsPerDayPerLead = 3;
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
}
