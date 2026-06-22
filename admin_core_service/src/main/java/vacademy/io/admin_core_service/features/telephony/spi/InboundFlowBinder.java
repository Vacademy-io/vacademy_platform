package vacademy.io.admin_core_service.features.telephony.spi;

import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderCredentials;

/**
 * Binds a provider number to the institute's inbound flow/application so
 * inbound calls route to us (Exotel: attach the ExoPhone to an App-Bazaar
 * flow). Only providers with the {@code NUMBER_ATTACH} capability register one.
 *
 * Providers whose numbers route inbound natively (Airtel/Vonage VBC — the lead
 * dials the counsellor's DID and it just rings) ship NO bean; the attacher then
 * treats "no binder" as "nothing to attach", not as an error.
 *
 * Takes the provider's opaque resource id (e.g. Exotel ExoPhone Sid) rather
 * than the JPA entity, to keep the SPI free of persistence types.
 */
public interface InboundFlowBinder {

    /** Matches institute_telephony_config.provider_type, e.g. "EXOTEL". */
    String providerType();

    /**
     * Attach the number to the institute's inbound flow.
     *
     * @param providerResourceId the provider's id for the number (Exotel ExoPhone Sid)
     * @param flowSid            the institute's configured inbound flow id
     * @param creds              decrypted provider credentials
     */
    void attach(String providerResourceId, String flowSid, ProviderCredentials creds);

    /** Optional unbind on number disable/delete. Default no-op. */
    default void detach(String providerResourceId, String flowSid, ProviderCredentials creds) {
        // no-op by default
    }
}
