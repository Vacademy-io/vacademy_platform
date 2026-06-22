package vacademy.io.admin_core_service.features.telephony.spi;

import vacademy.io.admin_core_service.features.telephony.spi.dto.OriginationContext;
import vacademy.io.admin_core_service.features.telephony.spi.dto.OriginationPlan;

/**
 * Decides the outbound origination (first-leg {@code from} + caller-ID +
 * provider-number) for a provider, so the core orchestration stops baking in
 * Exotel's verified-mobile + pooled-ExoPhone model.
 *
 * Every provider registers exactly one; the registry resolves it by
 * {@link #providerType()}. Exotel's resolver reproduces the old inline logic
 * (verified mobile + selector over the number pool); Airtel/Vonage's derives the
 * counsellor's extension + DID from the per-counsellor endpoint map (no pool).
 */
public interface OutboundOriginationResolver {

    /** Matches institute_telephony_config.provider_type, e.g. "EXOTEL". */
    String providerType();

    /**
     * Resolve the origination for one outbound call. Throws a
     * {@code VacademyException} with an actionable message when origination
     * cannot be determined (no verified mobile, no number, no extension mapped).
     */
    OriginationPlan resolve(OriginationContext ctx);
}
