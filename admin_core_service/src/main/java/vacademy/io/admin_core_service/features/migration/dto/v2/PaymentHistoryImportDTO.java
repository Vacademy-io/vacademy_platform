package vacademy.io.admin_core_service.features.migration.dto.v2;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Date;

/**
 * Payment history entry for import
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentHistoryImportDTO {

    /**
     * Payment amount
     */
    @JsonProperty("amount")
    private BigDecimal amount;

    /**
     * Currency code (e.g., AUD, USD, INR)
     */
    @JsonProperty("currency")
    private String currency;

    /**
     * Payment date
     */
    @JsonProperty("date")
    private Date date;

    /**
     * Payment status: PAID, PENDING, FAILED, REFUNDED
     */
    @JsonProperty("status")
    private String status;

    /**
     * External transaction ID from source system
     */
    @JsonProperty("transaction_id")
    private String transactionId;

    /**
     * Payment gateway vendor: EWAY, STRIPE, RAZORPAY, etc.
     */
    @JsonProperty("vendor")
    private String vendor;

    // Helper methods
    public String getEffectiveStatus() {
        return status != null ? status.toUpperCase() : "PAID";
    }

    public String getEffectiveCurrency() {
        return currency != null ? currency.toUpperCase() : "AUD";
    }

    public String getEffectiveVendor() {
        return vendor != null ? vendor.toUpperCase() : "EWAY";
    }
}
