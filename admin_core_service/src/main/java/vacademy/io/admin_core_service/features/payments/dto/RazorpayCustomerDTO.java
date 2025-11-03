package vacademy.io.admin_core_service.features.payments.dto;

import lombok.Data;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Data
public class RazorpayCustomerDTO {
    private String id;
    private String entity;
    private String name;
    private String email;
    private String contact;
    private String gstin;
    private Long createdAt;
    private Object notes;
}


