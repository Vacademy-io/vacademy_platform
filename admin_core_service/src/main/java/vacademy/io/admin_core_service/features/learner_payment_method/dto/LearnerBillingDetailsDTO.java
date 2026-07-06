package vacademy.io.admin_core_service.features.learner_payment_method.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LearnerBillingDetailsDTO {
    private String name;
    private String email;
    private String addressLine;
    private String city;
    private String state;
    private String postalCode;
    private String country;
}
