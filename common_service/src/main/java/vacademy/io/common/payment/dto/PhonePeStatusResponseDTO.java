package vacademy.io.common.payment.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class PhonePeStatusResponseDTO {
    private String orderId;
    private String merchantId;
    private String merchantOrderId;
    private String state;
    private Long amount;
    private Long expireAt;
    private Map<String, String> metaInfo;
    private List<PaymentDetail> paymentDetails;
    private String errorCode;
    private String detailedErrorCode;
    private ErrorContext errorContext;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PaymentDetail {
        private String paymentMode;
        private String transactionId;
        private Long timestamp;
        private Long amount;
        private String state;
        private String errorCode;
        private String detailedErrorCode;
        private Rail rail;
        private Instrument instrument;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Rail {
        private String type;
        private String utr;
        private String upiTransactionId;
        private String vpa;
        private String authorizationCode;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Instrument {
        private String type;
        private String maskedAccountNumber;
        private String accountType;
        private String accountHolderName;
        private String bankId;
        private String brn;
        private String geoScope;
        private String cardNetwork;
        private String maskedCardNumber;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ErrorContext {
        private String errorCode;
        private String detailedErrorCode;
        private String source;
        private String stage;
        private String description;
    }
}
