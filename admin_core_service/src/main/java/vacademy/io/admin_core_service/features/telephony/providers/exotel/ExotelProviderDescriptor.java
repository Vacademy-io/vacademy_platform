package vacademy.io.admin_core_service.features.telephony.providers.exotel;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderCapability;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.spi.TelephonyProviderDescriptor;
import vacademy.io.admin_core_service.features.telephony.spi.dto.CredentialField;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Self-description for the Exotel adapter. Declares Exotel's capability set and
 * its credential schema so the admin UI and credential validation are driven by
 * data, not hard-coded provider knowledge.
 *
 * <p>Exotel still persists its credentials through the legacy
 * apiAccountId/apiUsername/apiPassword columns (the schema keys below mirror
 * those for the UI). The descriptor adds no behaviour to the working Exotel
 * path — it only makes Exotel a first-class entry in the provider registry
 * alongside future providers.
 */
@Component
public class ExotelProviderDescriptor implements TelephonyProviderDescriptor {

    @Override
    public String providerType() {
        return ProviderType.EXOTEL;
    }

    @Override
    public String displayName() {
        return "Exotel";
    }

    @Override
    public String authType() {
        return "BASIC";
    }

    /**
     * Exotel keeps its credentials in the legacy api_account_id/api_username_enc/
     * api_password_enc columns (what ExotelHttpClient reads), NOT the generic
     * blob — so the controller never splits an Exotel row's creds across both
     * stores. The schema keys below therefore mirror the legacy DTO field names.
     */
    @Override
    public boolean usesGenericCredentialStore() {
        return false;
    }

    @Override
    public Set<ProviderCapability> capabilities() {
        return EnumSet.of(
                ProviderCapability.OUTBOUND_CALL,
                ProviderCapability.NUMBER_POOL,
                ProviderCapability.SYNC_INBOUND_APPLET,
                ProviderCapability.REALTIME_EVENTS,
                ProviderCapability.RECORDING,
                ProviderCapability.NUMBER_ATTACH,
                ProviderCapability.NUMBER_SYNC,
                ProviderCapability.BALANCE);
    }

    @Override
    public List<CredentialField> credentialSchema() {
        // Keys mirror the legacy TelephonyConfigDTO field names (Exotel is a
        // legacy-store provider — see usesGenericCredentialStore()), so the
        // admin form maps each field 1:1 onto the existing save contract.
        return List.of(
                CredentialField.config("apiAccountId", "Account SID", true,
                        "Your Exotel Account SID (from the API Settings page)."),
                CredentialField.secret("apiUsername", "API Key", true,
                        "Exotel API Key — used as the HTTP Basic username."),
                CredentialField.secret("apiPassword", "API Token", true,
                        "Exotel API Token — used as the HTTP Basic password."),
                CredentialField.secret("webhookToken", "Webhook Token", false,
                        "Optional shared secret carried as ?token= on status callbacks. Leave blank for open mode."),
                CredentialField.config("flowSid", "App Bazaar Flow ID", false,
                        "Flow id for auto-attaching new ExoPhones to your inbound Connect applet."));
    }
}
