package vacademy.io.auth_service.feature.vimotion.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class RedemptionDTO {
    private String id;
    private String inviteCodeId;
    private String email;
    private String phoneNumber;
    private String userId;
    private String instituteId;
    private Date redeemedAt;
}
