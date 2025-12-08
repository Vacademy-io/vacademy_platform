package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;
import vacademy.io.common.auth.dto.UserDTO;

import java.sql.Timestamp;
import java.time.LocalDateTime;

@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class MembershipDetailsDTO {
    private UserPlanDTO userPlan;
    private UserDTO userDetails;
    private String membershipStatus; // ENDED, ABOUT_TO_END, LIFETIME
    private Timestamp calculatedEndDate;
}