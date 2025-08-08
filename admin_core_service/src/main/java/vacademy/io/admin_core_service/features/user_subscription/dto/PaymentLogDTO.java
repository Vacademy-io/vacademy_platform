package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.user_subscription.entity.AppliedCouponDiscount;

import java.time.LocalDateTime;
import java.util.Date;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Data
public class PaymentLogDTO {
    private String id;
    private String status;
    private String paymentStatus;
    private String userId;
    private String vendor;
    private String vendorId;
    private Date date;
    private String currency;
    private String paymentSpecificData;
}
