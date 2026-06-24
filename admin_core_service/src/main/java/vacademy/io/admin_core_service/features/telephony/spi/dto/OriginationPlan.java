package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;

/**
 * An {@code OutboundOriginationResolver}'s decision for one outbound call:
 * the first-leg {@code from}, the caller-ID the lead sees, and (for pooled
 * providers) which {@code telephony_provider_number} was chosen.
 *
 * <ul>
 *   <li>Exotel: {@code from} = the counsellor's verified mobile, {@code callerId}
 *       = the selected ExoPhone, {@code providerNumberId} = its id.</li>
 *   <li>Airtel/Vonage: {@code from} = the counsellor's extension, {@code callerId}
 *       = their DID, {@code providerNumberId} = null (no pool).</li>
 * </ul>
 */
@Value
@Builder
public class OriginationPlan {
    /** First-leg origination (Exotel: verified mobile; Airtel: counsellor extension). */
    String from;
    /** Caller-ID the lead sees (Exotel: ExoPhone; Airtel: counsellor DID). May be null. */
    String callerId;
    /** Chosen telephony_provider_number id for pooled providers; null for no-pool. */
    String providerNumberId;
}
