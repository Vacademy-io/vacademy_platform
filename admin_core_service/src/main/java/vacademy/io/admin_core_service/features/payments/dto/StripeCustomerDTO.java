package vacademy.io.admin_core_service.features.payments.dto;

import lombok.Data;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Data
public class StripeCustomerDTO {
    private String id;
    private String email;
    private String name;
    private String phone;
    private Long created;
    private String invoicePrefix;
    private Boolean livemode;

    // Getters/setters or use Lombok
}
