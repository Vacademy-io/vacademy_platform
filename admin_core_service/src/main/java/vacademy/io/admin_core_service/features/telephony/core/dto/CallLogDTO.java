package vacademy.io.admin_core_service.features.telephony.core.dto;

import lombok.Builder;
import lombok.Data;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;

import java.math.BigDecimal;
import java.sql.Timestamp;

/**
 * Outward projection of a call-log row — masked phone numbers, no raw payload,
 * no decrypted creds. Side-view and admin call history both render this.
 */
@Data
@Builder
public class CallLogDTO {
    private String id;
    private String providerType;
    private String direction;
    private String status;
    private String terminationReason;
    private String fromNumberMasked;
    private String toNumberMasked;
    private String callerId;
    private Timestamp startTime;
    private Timestamp answerTime;
    private Timestamp endTime;
    private Integer durationSeconds;
    private BigDecimal price;
    private boolean hasRecording;
    private String counsellorUserId;
    private String responseId;
    private String userId;
    /** AI-call disposition, joined in at read time from ai_call_result; null for non-AI/Exotel calls. */
    private String aiDisposition;
    /** Row creation time — used as the call-time fallback for AI calls, which don't populate start_time. */
    private Timestamp createdAt;
    /** AI-call attempt number from ai_call_result (0 = first dial, 1+ = retries); null for non-AI calls. */
    private Integer aiCallRetry;

    public static CallLogDTO from(TelephonyCallLog r) {
        return CallLogDTO.builder()
                .createdAt(r.getCreatedAt())
                .id(r.getId())
                .providerType(r.getProviderType())
                .direction(r.getDirection())
                .status(r.getStatus())
                .terminationReason(r.getTerminationReason())
                .fromNumberMasked(mask(r.getFromNumber()))
                .toNumberMasked(mask(r.getToNumber()))
                .callerId(r.getCallerId())
                .startTime(r.getStartTime())
                .answerTime(r.getAnswerTime())
                .endTime(r.getEndTime())
                .durationSeconds(r.getDurationSeconds())
                .price(r.getPrice())
                .hasRecording(r.getRecordingStorageKey() != null)
                .counsellorUserId(r.getCounsellorUserId())
                .responseId(r.getResponseId())
                .userId(r.getUserId())
                .build();
    }

    private static String mask(String number) {
        if (number == null || number.length() < 4) return number;
        int keep = 4;
        String tail = number.substring(number.length() - keep);
        return "*".repeat(number.length() - keep) + tail;
    }
}
