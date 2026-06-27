package vacademy.io.admin_core_service.features.telephony.core.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

import java.sql.Timestamp;

/**
 * One row of the team calling dashboard. Provider-agnostic: AI (Aavtaar) and
 * human (Exotel/Airtel), inbound and outbound, all project to this shape.
 *
 * <p>{@code fromNumber}/{@code toNumber} are masked unless the caller holds the
 * {@code VIEW_CALL_NUMBERS} authority (see the controller). {@code leadNumber} is
 * the counterparty number (to_number on outbound, from_number on inbound),
 * masked under the same gate.
 */
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CallRowDTO {

    private String id;
    private String providerType;
    /** AI | HUMAN — derived, not stored. */
    private String callType;
    private String direction;
    private String status;
    private String terminationReason;

    private String fromNumber;
    private String toNumber;
    /** Counterparty (the lead's) number, masked under the same gate. */
    private String leadNumber;
    private String callerId;

    private Timestamp startTime;
    private Timestamp answerTime;
    private Timestamp endTime;
    private Integer durationSeconds;
    private boolean hasRecording;

    private String counsellorUserId;
    private String counsellorName;
    private String responseId;
    private String userId;
    private String leadName;

    // Manual (human-set) disposition.
    private String dispositionKey;
    private String dispositionNotes;
    private Timestamp dispositionedAt;

    /** AI-call disposition from ai_call_result; null for non-AI calls. */
    private String aiDisposition;
    /** Effective promised call-back time (human callback_at or AI callback_at). */
    private Timestamp callbackAt;

    private Timestamp createdAt;
}
