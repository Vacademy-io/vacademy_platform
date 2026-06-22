package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.Map;

/**
 * Provider-neutral end-of-call outcome. Every AI-voice adapter's parser emits
 * this; the core (landing-zone persistence + outcome processor) only ever sees
 * this type. Richer than {@code NormalizedCallEvent} on purpose — it carries the
 * conversational outcome (disposition, Q&A, rating, summary, callback, transfer)
 * the assign-vs-retry decision needs.
 */
@Value
@Builder
public class AiCallReport {
    String provider;
    String callUuid;
    /** Our id echoed back in metadata on outbound calls. */
    String correlationId;
    String direction;          // INBOUND / OUTBOUND
    String campaignType;
    String campaignId;

    String status;             // raw provider status, e.g. "completed"
    Integer durationSeconds;
    Instant callStart;

    String disposition;
    String leadResponse;
    Integer leadRating;
    Integer callRating;
    String interestLevel;
    String summary;
    Map<String, Object> extractedQa;
    Map<String, Object> metadata;

    String recordingUrl;
    String transcript;

    Boolean callbackRequested;
    Instant callbackAt;
    String callbackTimeText;

    Boolean transferAttempted;
    Boolean ninePressed;
    String transferStatus;
    String transferTriggered;

    String hangupCause;
    Integer hangupCode;
    String hangupSource;

    String phoneNumber;
    String dialCode;
    Integer callRetry;
    String customerName;
    String customerEmail;

    String rawPayload;
}
