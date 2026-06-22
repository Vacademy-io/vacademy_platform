package vacademy.io.admin_core_service.features.telephony.providers.aavtaar.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.util.HashMap;
import java.util.Map;

/**
 * Contract for Aavtaar's end-of-call webhook (one object per call).
 *
 * Field names are lenient on purpose: each maps to both a clean camelCase key
 * AND the actual keys seen in Aavtaar's report (Title-Case with spaces, snake_
 * case, camelCase mixed), so the receiver works whether they adopt our clean
 * contract or point their existing webhook at us. Anything not explicitly mapped
 * (the campaign-specific extracted Q&A) is collected into {@link #extra} via
 * {@link JsonAnySetter} and stored as JSON — so no field is ever lost.
 */
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class AavtaarCallWebhookRequest {

    @JsonAlias({"call_uuid", "callUuid", "callId", "call_id"})
    private String callUuid;

    @JsonAlias({"phoneNumber", "Phone Number", "phone_number", "number"})
    private String phoneNumber;

    @JsonAlias({"dialCode", "Dial Code", "dial_code"})
    private String dialCode;

    @JsonAlias({"callRetry", "Call Retry", "call_retry"})
    private Integer callRetry;

    @JsonAlias({"customerName", "Customer Name", "customer_name"})
    private String customerName;

    @JsonAlias({"customerEmail", "Customer Email", "customer_email"})
    private String customerEmail;

    @JsonAlias({"campaignType", "Campaign Type", "campaign_type"})
    private String campaignType;

    @JsonAlias({"campaignId", "Campaign Id", "campaign_id", "CampaignId"})
    private String campaignId;

    @JsonAlias({"callStart", "Call Start", "call_start"})
    private String callStart;

    @JsonAlias({"duration", "Duration", "durationSeconds", "duration_seconds"})
    private Double duration;

    @JsonAlias({"status", "Status"})
    private String status;

    @JsonAlias({"disposition", "Disposition"})
    private String disposition;

    @JsonAlias({"leadResponse", "Lead Response", "lead_response"})
    private String leadResponse;

    @JsonAlias({"leadRating", "Lead Rating", "lead_rating"})
    private Integer leadRating;

    @JsonAlias({"callRating", "Call Rating", "call_rating"})
    private Integer callRating;

    @JsonAlias({"interestLevel", "Customer Interest Level", "interest_level"})
    private String interestLevel;

    @JsonAlias({"callSummary", "Call Summary", "summary", "leadSummary", "Lead Summary", "aiSummary"})
    private String aiSummary;

    /** "Yes" / "No" (or a boolean). */
    @JsonAlias({"callback", "Callback"})
    private String callback;

    @JsonAlias({"callbackTimestamp", "Callback Timestamp", "callback_timestamp"})
    private String callbackTimestamp;

    @JsonAlias({"callbackTime", "Callback Time"})
    private String callbackTime;

    @JsonAlias({"transfer_call", "transferCall"})
    private Boolean transferCall;

    @JsonAlias({"nine_pressed", "ninePressed"})
    private Boolean ninePressed;

    @JsonAlias({"transfer_status", "transferStatus"})
    private String transferStatus;

    @JsonAlias({"Transfer Triggered", "transferTriggered", "transfer_triggered"})
    private String transferTriggered;

    @JsonAlias({"hangupCause", "hangup_cause"})
    private String hangupCause;

    @JsonAlias({"hangupCauseCode", "hangup_cause_code", "hangupCode"})
    private Integer hangupCauseCode;

    @JsonAlias({"hangupSource", "hangup_source"})
    private String hangupSource;

    @JsonAlias({"recordingUrl", "Recording URL", "recording_url"})
    private String recordingUrl;

    @JsonAlias({"transcript", "Call Transcript", "call_transcript"})
    private String transcript;

    /** Our reference, when Aavtaar echoes outbound metadata. */
    @JsonAlias({"correlationId", "correlation_id"})
    private String correlationId;

    @JsonAlias({"metadata"})
    private Map<String, Object> metadata;

    /** Everything not explicitly mapped (campaign-specific extracted Q&A). */
    private final Map<String, Object> extra = new HashMap<>();

    @JsonAnySetter
    public void put(String key, Object value) {
        extra.put(key, value);
    }
}
