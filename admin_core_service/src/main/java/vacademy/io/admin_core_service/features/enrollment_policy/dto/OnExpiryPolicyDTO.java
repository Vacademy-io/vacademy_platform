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

    // ── Autopay / mandate + free-trial (recurring) ──────────────────────────

    /**
     * Free-trial length in days. When > 0, enrollment registers the mandate but
     * takes NO real payment; the plan's end_date/next_charge_at is set to
     * now + trialDays, and the FIRST real debit happens on that date. 0/null =
     * no trial (charge immediately, autopay from next cycle).
     */
    Integer trialDays;

    /**
     * Mandate debit frequency hint sent to the gateway at registration
     * (as_presented | monthly | ...). Default: as_presented.
     */
    String mandateFrequency;

    /**
     * Multiplier applied to the plan amount to derive the mandate max_amount
     * (headroom for taxes / price changes). Default 1.0 → max_amount = amount.
     */
    Double mandateBufferMultiplier;

    /**
     * Max number of recurring-charge attempts before the plan is expired. If
     * null, falls back to the retry-on-last-day-of-waiting-period behaviour.
     */
    Integer maxRenewalAttempts;
}
