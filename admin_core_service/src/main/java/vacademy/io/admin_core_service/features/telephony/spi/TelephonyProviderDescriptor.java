package vacademy.io.admin_core_service.features.telephony.spi;

import vacademy.io.admin_core_service.features.telephony.enums.ProviderCapability;
import vacademy.io.admin_core_service.features.telephony.spi.dto.CredentialField;

import java.util.List;
import java.util.Set;

/**
 * Self-description of a telephony provider adapter. Every provider registers
 * exactly one descriptor bean; {@code TelephonyProviderRegistry} indexes it by
 * {@link #providerType()}.
 *
 * This is the single source of truth the rest of the system reads instead of
 * hard-coding provider knowledge:
 *   - the admin UI's provider dropdown + dynamically-rendered credential form
 *     come from {@link #displayName()} + {@link #credentialSchema()};
 *   - capability-gated behaviour (number pool, sync inbound applet, recording,
 *     transfer, balance, …) comes from {@link #capabilities()};
 *   - credential validation on save runs against {@link #credentialSchema()};
 *   - the token broker picks an auth strategy from {@link #authType()}.
 *
 * Onboarding a new provider therefore needs no edit here or in any shared
 * module — drop a new descriptor bean (plus the ports the provider supports).
 */
public interface TelephonyProviderDescriptor {

    /** Matches {@code institute_telephony_config.provider_type}, e.g. "AIRTEL". */
    String providerType();

    /** Human label for the admin UI dropdown, e.g. "Airtel IQ (Vonage VBC)". */
    String displayName();

    /** The capabilities this adapter implements. */
    Set<ProviderCapability> capabilities();

    /** The credential/config fields the admin must provide, in display order. */
    List<CredentialField> credentialSchema();

    /** Auth scheme the token broker uses: BASIC | OAUTH2_PASSWORD | … */
    default String authType() {
        return "BASIC";
    }

    /**
     * Whether this provider's credentials persist in the generic
     * {@code provider_secrets_enc}/{@code provider_config} blob (true) or in the
     * legacy {@code api_account_id}/{@code api_username_enc}/{@code api_password_enc}
     * columns (false). Exotel predates the generic model and its HTTP client reads
     * the legacy triplet directly, so it returns false — keeping its credentials
     * in one place and never split across both stores. Every new provider uses
     * the generic store (the default).
     */
    default boolean usesGenericCredentialStore() {
        return true;
    }

    default boolean supports(ProviderCapability capability) {
        return capabilities().contains(capability);
    }
}
