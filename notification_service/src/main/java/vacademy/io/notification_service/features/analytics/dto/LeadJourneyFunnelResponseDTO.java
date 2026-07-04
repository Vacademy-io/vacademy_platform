package vacademy.io.notification_service.features.analytics.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response for the lead-journey daily-message funnel.
 *
 * <p>Reports, per day of the drip, how many messages went out, to how many
 * distinct recipients, and how many of those recipients replied. Also returns a
 * per-recipient roster so admins can see exactly who received which day and who
 * has gone silent.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeadJourneyFunnelResponseDTO {

    private String instituteId;
    private DateRangeDTO dateRange;
    private String templatePrefix;
    private Integer totalDays;
    private Summary summary;
    private List<DayMetric> days;
    private List<Recipient> recipients;
    /** True when the recipient roster was capped by the fetch limit. */
    private Boolean recipientsTruncated;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Summary {
        private Long totalSends;
        private Integer uniqueRecipients;
        private Integer repliedRecipients;
        private Double replyRate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class DayMetric {
        private Integer dayNumber;
        private String templateIdentifier;
        private Long totalSends;
        private Integer uniqueRecipients;
        private Integer replied;
        private Double replyRate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Recipient {
        private String phone;
        private String center;
        private List<Integer> daysReceived;
        private Integer messageCount;
        private String lastSentAt;
        private Boolean replied;
    }
}
