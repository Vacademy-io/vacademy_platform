package vacademy.io.common.payment.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true) // Best practice for external APIs
public class EwayTransaction {

    @JsonProperty("AuthorisationCode")
    private String authorisationCode;

    @JsonProperty("ResponseCode")
    private String responseCode;

    @JsonProperty("ResponseMessage")
    private String responseMessage;

    @JsonProperty("InvoiceNumber")
    private String invoiceNumber;

    @JsonProperty("InvoiceReference")
    private String invoiceReference;

    @JsonProperty("TotalAmount")
    private Integer totalAmount;

    @JsonProperty("TransactionID")
    private Long transactionID; // Use Long for large numbers

    @JsonProperty("TransactionStatus")
    private Boolean transactionStatus;

    @JsonProperty("TokenCustomerID")
    private Long tokenCustomerID; // Use Long for large numbers

    @JsonProperty("BeagleScore")
    private Object beagleScore; // Can be null or other types

    @JsonProperty("Verification")
    private Verification verification;

    @JsonProperty("Customer")
    private Customer customer;

    @Data
    @NoArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Verification {
        @JsonProperty("CVN")
        private int cvn;
        @JsonProperty("Address")
        private int address;
        @JsonProperty("Email")
        private int email;
        @JsonProperty("Mobile")
        private int mobile;
        @JsonProperty("Phone")
        private int phone;
    }

    @Data
    @NoArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Customer {
        @JsonProperty("TokenCustomerID")
        private Long tokenCustomerID;
        @JsonProperty("FirstName")
        private String firstName;
        @JsonProperty("LastName")
        private String lastName;
        @JsonProperty("Country")
        private String country;
        // Add other customer fields as needed
    }
}
