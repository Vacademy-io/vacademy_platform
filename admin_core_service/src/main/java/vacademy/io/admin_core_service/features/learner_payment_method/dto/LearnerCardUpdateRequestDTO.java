package vacademy.io.admin_core_service.features.learner_payment_method.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LearnerCardUpdateRequestDTO {
    private String vendor;
    private StripeCardUpdate stripe;
    private EwayCardUpdate eway;

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class StripeCardUpdate {
        /** PaymentMethod id from the confirmed SetupIntent. */
        private String paymentMethodId;
    }

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class EwayCardUpdate {
        private String cardName;
        private String expiryMonth;
        private String expiryYear;
        /** eCrypt-encrypted values, never plaintext PAN/CVN. */
        private String encryptedCardNumber;
        private String encryptedCvn;
        private String countryCode;
    }
}
