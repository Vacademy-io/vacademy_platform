package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PaymentLogFilterRequestDTO {
    private String instituteId;

    private LocalDateTime startDateInUtc;

    private LocalDateTime endDateInUtc;

    private List<String> packageSessionIds;

    private List<String> enrollInviteIds;

    private List<String> paymentStatuses;    private Map<String, String> sortColumns;

    private List<String> userPlanStatuses;

    /**
     * Filter by UserPlan source: List of sources (USER, SUB_ORG)
     */
    private List<String> sources;
}

