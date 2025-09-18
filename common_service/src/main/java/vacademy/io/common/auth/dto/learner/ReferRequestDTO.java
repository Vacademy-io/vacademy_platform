package vacademy.io.common.auth.dto.learner;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ReferRequestDTO {
    private String referrerUserId;
    private String referralCode;
    private String referralOptionId;
}
