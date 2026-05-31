package vacademy.io.auth_service.feature.vimotion.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class WaitlistStatusResponse {
    private String id;
    private String fullName;
    private String email;
    private String status;
    private String referralCode;
    private Integer referralCount;
    private Integer position;
    private Integer effectivePosition;
    private Long totalCount;
}
