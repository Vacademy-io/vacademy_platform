package vacademy.io.admin_core_service.features.suborg.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.institute.dto.InstituteInfoDTO;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CreateSubOrgSubscriptionDTO {
    private InstituteInfoDTO subOrgDetails;
    private List<String> packageSessionIds;
    private String paymentType;       // SUBSCRIPTION, ONE_TIME, FREE, CPO
    private Double actualPrice;
    private Double elevatedPrice;
    private String currency;
    private Integer memberCount;      // Seat cap
    private Integer validityInDays;
    private String vendor;
    private String vendorId;
    private List<String> authRoles;   // Auth service roles for sub-org admin (e.g. ["TEACHER"])

    /**
     * Custom roles the sub-org admin is allowed to assign when adding team members on
     * /manage-suborg-teams. Empty/null means no restriction (any custom role available
     * to the institute). Configured here at creation, editable later via PATCH.
     */
    private List<String> allowedTeamRoles;

    // Required when paymentType=CPO. Points at an existing ComplexPaymentOption that
    // will become the sub-org admin's payment plan (installment tree). Learners stay
    // FREE under the scoped invites; only the admin's UserPlan gets StudentFeePayment
    // rows generated, mirroring the bulk/v3/assign CPO flow.
    private String complexPaymentOptionId;
}
