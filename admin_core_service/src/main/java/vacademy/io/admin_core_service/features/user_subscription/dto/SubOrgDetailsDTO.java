package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO containing sub-organization (Institute) details for UserPlan.
 * Used when UserPlan has source = SUB_ORG and subOrgId is not null.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubOrgDetailsDTO {
    
    /**
     * Institute/Sub-organization ID
     */
    private String id;
    
    /**
     * Institute/Sub-organization name
     */
    private String name;
    
    /**
     * Institute/Sub-organization address
     */
    private String address;
}
