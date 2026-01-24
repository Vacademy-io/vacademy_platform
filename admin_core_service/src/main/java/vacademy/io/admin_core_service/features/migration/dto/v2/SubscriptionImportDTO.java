package vacademy.io.admin_core_service.features.migration.dto.v2;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * Subscription details for enrollment import
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubscriptionImportDTO {

    /**
     * Subscription start date (required)
     */
    @JsonProperty("start_date")
    private Date startDate;

    /**
     * Duration in days (use this OR duration_months)
     */
    @JsonProperty("duration_days")
    private Integer durationDays;

    /**
     * Duration in months (use this OR duration_days)
     */
    @JsonProperty("duration_months")
    private Integer durationMonths;

    /**
     * Subscription status: ACTIVE, CANCELLED, EXPIRED
     */
    @JsonProperty("status")
    private String status;

    /**
     * Cancellation date (required if status = CANCELLED)
     */
    @JsonProperty("cancellation_date")
    private Date cancellationDate;

    /**
     * Next billing date (for active subscriptions)
     */
    @JsonProperty("next_billing_date")
    private Date nextBillingDate;

    // Helper methods
    public String getEffectiveStatus() {
        return status != null ? status.toUpperCase() : "ACTIVE";
    }

    public boolean isActive() {
        return "ACTIVE".equalsIgnoreCase(status);
    }

    public boolean isCancelled() {
        return "CANCELLED".equalsIgnoreCase(status);
    }

    public boolean isExpired() {
        return "EXPIRED".equalsIgnoreCase(status);
    }

    /**
     * Calculate end date based on start date and duration
     */
    public Date getCalculatedEndDate() {
        if (startDate == null) {
            return null;
        }

        java.util.Calendar calendar = java.util.Calendar.getInstance();
        calendar.setTime(startDate);

        if (durationMonths != null && durationMonths > 0) {
            calendar.add(java.util.Calendar.MONTH, durationMonths);
        } else if (durationDays != null && durationDays > 0) {
            calendar.add(java.util.Calendar.DAY_OF_MONTH, durationDays);
        }

        return calendar.getTime();
    }

    /**
     * Get end date - prioritize nextBillingDate, then calculated
     */
    public Date getEffectiveEndDate() {
        if (nextBillingDate != null) {
            return nextBillingDate;
        }
        return getCalculatedEndDate();
    }
}
