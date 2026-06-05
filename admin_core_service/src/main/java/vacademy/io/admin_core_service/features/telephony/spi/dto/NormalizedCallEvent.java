package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;
import vacademy.io.admin_core_service.features.telephony.enums.CallStatus;

import java.sql.Timestamp;

/**
 * Provider-neutral shape every webhook adapter emits. The core domain handles
 * only this type. If a new field shows up in some provider's payload, it lands
 * in `rawPayload` for debugging — the SPI contract doesn't have to grow.
 */
@Value
@Builder
public class NormalizedCallEvent {
    String correlationId;        // our_correlation_id (= TelephonyCallLog.id)
    String providerCallId;       // e.g. Exotel CallSid
    CallStatus status;
    String terminationReason;
    Timestamp startTime;
    Timestamp answerTime;
    Timestamp endTime;
    Integer durationSeconds;
    Double price;
    String recordingUrl;
    String rawPayload;           // verbatim provider body, persisted on the row

    public boolean isTerminal() {
        return status != null && status.isTerminal();
    }
}
