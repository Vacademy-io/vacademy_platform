package vacademy.io.admin_core_service.features.telephony.core.dto;

import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementAction;

import java.time.Instant;

/**
 * One thing an AI call promised, and what became of it — the Call Log's answer to
 * "it said it would WhatsApp the link, did it?".
 *
 * <p>Deliberately a projection, not the entity: engagement_action carries the draft body,
 * the rationale, the LLM token counts and the member id, none of which belong on a call
 * row. The variables are omitted too — they hold the lead's own name, phone and email, and
 * this endpoint is readable by anyone with institute access, unlike the diagnostics blob
 * which is gated on VIEW_CALL_NUMBERS precisely because it contains verbatim caller speech.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CallActionDTO {

    private String id;

    /** The call this came from, from source_ref '<callLogId>:<ruleId>'. */
    private String callLogId;

    /** The rule that fired, from source_ref '<callLogId>:<ruleId>'. */
    private String ruleId;

    /** SHARE_LINK | SEND_MESSAGE | BOOK_MEETING. */
    private String actionType;

    /** WHATSAPP | EMAIL. */
    private String channel;

    /** OPEN (queued) | DISPATCHING | SENT | FAILED | EXPIRED, or a task state. */
    private String status;

    private String templateName;

    /** Why it failed, verbatim from the vendor — the fastest diagnosis there is. */
    private String errorMessage;

    /** When the rule fired (mid-call, or when the report landed). */
    private Instant createdAt;

    /** When it actually went out. Null while queued or after a failure. */
    private Instant dispatchedAt;

    public static CallActionDTO from(EngagementAction a) {
        String ref = a.getSourceRef() == null ? "" : a.getSourceRef();
        int colon = ref.indexOf(':');
        return CallActionDTO.builder()
                .id(a.getId())
                .callLogId(colon > 0 ? ref.substring(0, colon) : null)
                .ruleId(colon >= 0 ? ref.substring(colon + 1) : null)
                .actionType(a.getActionType())
                .channel(a.getChannel())
                .status(a.getStatus())
                .templateName(a.getTemplateName())
                .errorMessage(a.getErrorMessage())
                .createdAt(a.getCreatedAt())
                .dispatchedAt(a.getDispatchedAt())
                .build();
    }
}
