package vacademy.io.common.payment.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class EwayRequestDTO {

    private String customerId;

    // Plaintext fields required by the API alongside encrypted data
    private String cardName;
    private String expiryMonth;
    private String expiryYear;

    // Encrypted fields, generated individually on the client
    private String cardNumber;
    private String cvn;
    private String countryCode;
}
