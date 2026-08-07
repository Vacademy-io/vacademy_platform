package vacademy.io.admin_core_service.features.super_admin.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * One AI call, as the super-admin call review needs it: who it was for, what it
 * cost us, what we billed, and enough to open the recording and the health
 * post-mortem without a second round trip.
 *
 * <p>COST IS MODELLED, not measured, and the flag says so. The voice bot does
 * not yet report its token or character usage (ai_token_usage has no voice
 * rows) and telephony_call_log.price has never been populated on a single row
 * of 9,690 — so every rupee here is duration x a rate-card row. A margin number
 * nobody can audit is worse than none, hence {@link #costIsModelled}.
 */
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@NoArgsConstructor
@AllArgsConstructor
public class SuperAdminCallDTO {
    private String id;
    private String correlationId;
    private String instituteId;
    private String instituteName;

    private String agentId;
    private String agentName;
    /** TTS engine actually used for this agent: google | sarvam | rumik | smallest. */
    private String ttsModel;
    private String voice;

    private String phoneNumber;
    private String customerName;
    private String direction;
    private String status;
    private String disposition;

    private java.util.Date callStart;
    private Integer durationSeconds;

    /** Recording lives on the joined telephony_call_log row, not on ai_call_result. */
    private String recordingUrl;
    private Boolean hasRecording;

    private String health;              // GREEN | AMBER | RED
    private List<String> faults;
    /** The full diagnostics blob, so the health sheet renders without a second call. */
    private String diagnostics;

    private Double costInr;
    private Double billedInr;
    private Double marginInr;
    private Double marginPct;
    /** Per-component rupee breakdown: plivo / stt / tts / llm. */
    private java.util.Map<String, Double> costBreakdown;
    private Boolean costIsModelled;
}
