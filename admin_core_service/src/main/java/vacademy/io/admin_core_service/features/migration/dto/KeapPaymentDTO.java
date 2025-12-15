package vacademy.io.admin_core_service.features.migration.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.Date;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class KeapPaymentDTO {

    @JsonProperty("email")
    private String email;

    @JsonProperty("contact_id")
    private String contactId;

    @JsonProperty("amount")
    private Double amount;

    @JsonProperty("date")
    private Date date;

    @JsonProperty("transaction_id")
    private String transactionId;

    @JsonProperty("status")
    private String status; // PAID, FAILED, etc.
}
