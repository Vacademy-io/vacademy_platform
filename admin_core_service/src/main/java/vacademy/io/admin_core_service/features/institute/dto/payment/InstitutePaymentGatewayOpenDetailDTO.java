package vacademy.io.admin_core_service.features.institute.dto.payment;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.Map;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstitutePaymentGatewayOpenDetailDTO {
    Map<String,Object> openDetails;
}
