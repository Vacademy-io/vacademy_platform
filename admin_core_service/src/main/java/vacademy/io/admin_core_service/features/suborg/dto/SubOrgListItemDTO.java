package vacademy.io.admin_core_service.features.suborg.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

/**
 * Enriched sub-org (VLE) list row for the admin Manage VLEs table: the sub-org record
 * plus its resolved admin contact, plan status, seat usage and org-level invite —
 * everything the list needs in one call so the UI needn't fan out per row.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubOrgListItemDTO {
    private String suborgId;
    private String name;
    private String status;
    /** Root-admin of the sub-org (null when none resolved / auth lookup failed). */
    private String adminName;
    private String adminEmail;
    private String adminPhone;
    /** The admin's UserPlan status (ACTIVE, PENDING_FOR_PAYMENT, …); null when no plan. */
    private String planStatus;
    /** Active learner-seat count; null total = no cap configured. */
    private Long usedSeats;
    private Integer totalSeats;
    private String inviteCode;
    private String shortUrl;
    private Timestamp createdAt;
}
