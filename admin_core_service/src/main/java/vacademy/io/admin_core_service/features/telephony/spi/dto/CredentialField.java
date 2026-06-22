package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;

/**
 * One field in a provider's credential/config schema. An adapter declares its
 * full set via {@code TelephonyProviderDescriptor#credentialSchema()}; the admin
 * UI renders the credential form directly from this (no provider-specific
 * frontend), and the controller validates the submitted values against it.
 *
 * {@code secret == true} fields are stored encrypted in
 * {@code provider_secrets_enc} and never echoed back (the GET projection only
 * reports whether a value is set). {@code secret == false} fields are non-secret
 * config stored in {@code provider_config} and rendered back verbatim.
 */
@Value
@Builder
public class CredentialField {
    /** Stable key the value is stored under (e.g. "consumerKey", "accountId"). */
    String key;
    /** Human label for the admin form (e.g. "Consumer Key"). */
    String label;
    /** True => encrypted secret (provider_secrets_enc); false => non-secret config. */
    boolean secret;
    /** True => must be present on first save. */
    boolean required;
    /** Optional helper text shown under the field. */
    String helpText;
    /** Optional client-side validation regex (null = none). */
    String validationRegex;

    public static CredentialField secret(String key, String label, boolean required, String help) {
        return CredentialField.builder().key(key).label(label).secret(true).required(required).helpText(help).build();
    }

    public static CredentialField config(String key, String label, boolean required, String help) {
        return CredentialField.builder().key(key).label(label).secret(false).required(required).helpText(help).build();
    }
}
