package vacademy.io.admin_core_service.features.migration.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.Date;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class KeapUserDTO {

    // User Details
    @JsonProperty("contact_id")
    private String contactId;

    @JsonProperty("email")
    private String email;

    @JsonProperty("first_name")
    private String firstName;

    @JsonProperty("last_name")
    private String lastName;

    @JsonProperty("phone")
    private String phone;

    @JsonProperty("address")
    private String address;

    @JsonProperty("city")
    private String city;

    @JsonProperty("state")
    private String state;

    @JsonProperty("zip_code")
    private String zipCode;

    @JsonProperty("country")
    private String country;

    // Subscription Details
    @JsonProperty("product_id")
    private String productId;

    @JsonProperty("start_date")
    private Date startDate;

    @JsonProperty("next_bill_date")
    private Date nextBillDate; // Can be null if cancelled/expired

    @JsonProperty("status")
    private String status; // Active, Inactive

    @JsonProperty("eway_token")
    private String ewayToken;

    @JsonProperty("amount")
    private Double amount;

    @JsonProperty("currency")
    private String currency;

    @JsonProperty("Job Type")
    private String jobType;
    
    @JsonProperty("Phone Type")
    private String phoneType;

    @JsonProperty("practice_role")
    private String practiceRole;

    @JsonProperty("practice_name")
    private String practiceName;

    @JsonProperty("root_admin_id")
    private String rootAdminId;

    // Past Transactions
    @JsonProperty("transactions")
    private List<KeapTransactionDTO> transactions;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class KeapTransactionDTO {
        @JsonProperty("transaction_id")
        private String transactionId;

        @JsonProperty("date")
        private Date date;

        @JsonProperty("amount")
        private Double amount;

        @JsonProperty("status")
        private String status;
    }
}