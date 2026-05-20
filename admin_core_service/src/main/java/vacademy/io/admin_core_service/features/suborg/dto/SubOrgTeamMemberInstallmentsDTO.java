package vacademy.io.admin_core_service.features.suborg.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

/**
 * Per-team-member pending-installments summary for the {@code /manage-suborg-teams} view.
 *
 * The team list itself is FSPSSM-backed (no UserPlan involved), so most team members carry no
 * installments. Members are only present here when they have non-PAID StudentFeePayment rows —
 * i.e. they happen to have a CPO-backed UserPlan in addition to their team-member role.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubOrgTeamMemberInstallmentsDTO {

    private String subOrgId;
    private List<Row> members;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Row {
        private String userId;
        private BigDecimal outstandingAmount;
        private Integer pendingInstallmentsCount;
        private Integer totalInstallments;
        private Date nextDueDate;
        private BigDecimal nextDueAmount;
        private String nextDueStatus;
    }
}
