package vacademy.io.admin_core_service.features.telephony.providers.plivo;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderCapability;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.spi.TelephonyProviderDescriptor;
import vacademy.io.admin_core_service.features.telephony.spi.dto.CredentialField;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Self-description for the Plivo adapter — the carrier behind the first-party
 * "Vacademy Voice" product. Drives the admin "Calling service" dropdown + the
 * schema-rendered credential form. Uses the generic credential store (HTTP Basic
 * Auth ID/Token, no Exotel legacy triplet).
 *
 * <p>Multi-tenant model: each institute runs in its own Plivo <em>subaccount</em>
 * under our master account. The institute's row stores that subaccount's
 * Auth ID/Token (created during onboarding — see VoiceOnboardingService); per-call
 * APIs authenticate as the subaccount so usage + balance are isolated.
 *
 * <p>Capabilities grow per phase as the backing beans land: P1 adds the outbound
 * initiator + webhook handler + recording fetcher (declared here); inbound IVR
 * ({@code SYNC_INBOUND_APPLET}), live transfer ({@code TRANSFER}) and balance are
 * declared by later phases as their beans are added, so the UI never offers an
 * action that has no implementation.
 */
@Component
public class PlivoProviderDescriptor implements TelephonyProviderDescriptor {

    @Override
    public String providerType() {
        return ProviderType.PLIVO;
    }

    @Override
    public String displayName() {
        return "Vacademy Voice (Plivo)";
    }

    @Override
    public String authType() {
        return "BASIC";
    }

    /** New provider — credentials live in the generic provider_secrets_enc/provider_config blob. */
    @Override
    public boolean usesGenericCredentialStore() {
        return true;
    }

    @Override
    public Set<ProviderCapability> capabilities() {
        // P1: outbound bridge click-to-call, push status webhooks, recording.
        // P2: synchronous inbound applet + the multi-level IVR tree builder.
        // P3: a Vacademy-managed product with a settings-driven config surface.
        // TRANSFER (P6) and BALANCE are added with their beans.
        return EnumSet.of(
                ProviderCapability.OUTBOUND_CALL,
                ProviderCapability.NUMBER_POOL,
                ProviderCapability.REALTIME_EVENTS,
                ProviderCapability.RECORDING,
                ProviderCapability.SYNC_INBOUND_APPLET,
                ProviderCapability.IVR_BUILDER,
                ProviderCapability.MANAGED_VOICE);
    }

    @Override
    public List<CredentialField> credentialSchema() {
        return List.of(
                CredentialField.config("authId", "Plivo Auth ID", true,
                        "This institute's Plivo subaccount Auth ID (starts with \"SA\"). Auto-filled "
                        + "during Vacademy Voice onboarding once the subaccount is created."),
                CredentialField.secret("authToken", "Plivo Auth Token", true,
                        "The subaccount Auth Token paired with the Auth ID. Used for HTTP Basic auth on "
                        + "every call API and to verify the X-Plivo-Signature on status webhooks."),
                CredentialField.config("appId", "Plivo Application ID", false,
                        "The Plivo Application this institute's numbers are bound to for inbound IVR. "
                        + "Auto-filled during onboarding; leave blank until inbound is configured."));
    }
}
