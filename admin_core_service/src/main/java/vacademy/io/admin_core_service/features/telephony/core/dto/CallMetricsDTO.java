package vacademy.io.admin_core_service.features.telephony.core.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

/**
 * KPI strip for the team calling dashboard. Headline counts honor the SAME
 * filters as the call list (minus the worklist chips) so the strip and table
 * agree; {@code missedInboundDue} / {@code callbacksDue} are the chip badges,
 * computed over scope + date window only (the "needs attention" totals).
 */
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CallMetricsDTO {

    private long totalCalls;
    private long connectedCalls;
    /** 0–100, 1 decimal; null when no calls. */
    private Double connectRate;
    private long totalTalkSeconds;
    /** Average talk time over connected calls, seconds; null when none connected. */
    private Double avgTalkSeconds;
    private long uniqueLeads;
    private long inboundCalls;
    private long outboundCalls;
    private long aiCalls;
    private long humanCalls;

    // Worklist chip badges.
    private long missedInboundDue;
    private long callbacksDue;
}
