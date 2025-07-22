package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

import java.util.Date;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Data
@Builder
public class ReferralOptionDTO {
    private String id;
    private String name;
    private String status;
    private String source;
    private String sourceId;
    private String referrerDiscountJson;
    private String refereeDiscountJson;
    private Integer referrerVestingDays;
    private String tag;
    private String description;
    private Date createdAt;
    private Date updatedAt;
}
