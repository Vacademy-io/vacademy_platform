package vacademy.io.admin_core_service.features.migration.dto.v2;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * One-time payment details for enrollment import
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OneTimePaymentImportDTO {

    /**
     * Purchase date
     */
    @JsonProperty("purchase_date")
    private Date purchaseDate;

    /**
     * Access validity in days
     */
    @JsonProperty("validity_days")
    private Integer validityDays;

    /**
     * Status: ACTIVE, EXPIRED
     */
    @JsonProperty("status")
    private String status;

    // Helper methods
    public String getEffectiveStatus() {
        return status != null ? status.toUpperCase() : "ACTIVE";
    }

    public Date getEffectiveStartDate() {
        return purchaseDate != null ? purchaseDate : new Date();
    }

    /**
     * Calculate end date based on purchase date and validity
     */
    public Date getCalculatedEndDate() {
        Date start = getEffectiveStartDate();
        if (validityDays == null || validityDays <= 0) {
            return null; // No expiry
        }

        java.util.Calendar calendar = java.util.Calendar.getInstance();
        calendar.setTime(start);
        calendar.add(java.util.Calendar.DAY_OF_MONTH, validityDays);

        return calendar.getTime();
    }
}
