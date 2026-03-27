package vacademy.io.admin_core_service.features.suborg.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.institute.dto.InstituteInfoDTO;

import java.util.List;
import java.util.Map;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CreateSubOrgSubscriptionDTO {
    private InstituteInfoDTO subOrgDetails;
    private List<String> packageSessionIds;
    private String paymentType;       // SUBSCRIPTION, ONE_TIME, FREE
    private Double actualPrice;
    private Double elevatedPrice;
    private String currency;
    private Integer memberCount;      // Seat cap
    private Integer validityInDays;
    private String vendor;
    private String vendorId;
    private List<String> authRoles;   // Auth service roles for sub-org admin (e.g. ["TEACHER"])

    // Mapping of package_session_id -> list of enroll_invite_ids
    // Used to create FSPSSM entries with access_type = 'ENROLL_INVITE'
    private Map<String, List<String>> packageSessionInviteMapping;
}
