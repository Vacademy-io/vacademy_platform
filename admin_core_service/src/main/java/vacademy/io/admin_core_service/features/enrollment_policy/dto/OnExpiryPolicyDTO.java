package vacademy.io.admin_core_service.features.enrollment_policy.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Value;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;

@Value
@Jacksonized
@SuperBuilder
@JsonIgnoreProperties(ignoreUnknown = true)
public class OnExpiryPolicyDTO {
    Integer waitingPeriodInDays;

    /**
     * Whether to attempt automatic payment renewal for SUBSCRIPTION payment
     * options.
     * If false, no payment will be attempted and users will be moved to INVITED
     * after waiting period.
     * Only applies to SUBSCRIPTION payment options. FREE, DONATION, and ONE_TIME
     * never attempt payment.
     * 
     * Default: true (if not specified, auto-renewal is enabled for subscriptions)
     */
    Boolean enableAutoRenewal;
}
