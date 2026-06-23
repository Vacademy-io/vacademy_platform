package vacademy.io.admin_core_service.features.telephony.providers.airtel;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderCapability;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.spi.TelephonyProviderDescriptor;
import vacademy.io.admin_core_service.features.telephony.spi.dto.CredentialField;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Self-description for the Airtel IQ Business Connect (Vonage VBC) adapter.
 * Drives the admin "Calling service" dropdown + the schema-rendered credential
 * form. Uses the generic credential store (OAuth2 secrets, no Exotel triplet).
 *
 * <p>v1 capabilities: outbound click-to-call + recording (recordings + CDRs are
 * imported from Airtel's CCR/CDR S3 export — see AirtelCcrImportService). Inbound
 * is native (no applet) and real-time events/transfer (VIS) are not yet wired.
 */
@Component
public class AirtelProviderDescriptor implements TelephonyProviderDescriptor {

    @Override
    public String providerType() {
        return ProviderType.AIRTEL;
    }

    @Override
    public String displayName() {
        return "Airtel IQ (Vonage VBC)";
    }

    @Override
    public String authType() {
        return "OAUTH2_PASSWORD";
    }

    @Override
    public Set<ProviderCapability> capabilities() {
        return EnumSet.of(
                ProviderCapability.OUTBOUND_CALL,
                ProviderCapability.RECORDING);
    }

    @Override
    public List<CredentialField> credentialSchema() {
        return List.of(
                CredentialField.secret("consumerKey", "Consumer Key", true,
                        "OAuth Consumer Key from apimanager.uc.vonage.com → your application → Production Keys."),
                CredentialField.secret("consumerSecret", "Consumer Secret", true,
                        "OAuth Consumer Secret paired with the Consumer Key."),
                CredentialField.secret("vbcUsername", "API Username", true,
                        "The non-SSO VBC API user (the '@vbc.prod' suffix is added automatically)."),
                CredentialField.secret("vbcPassword", "API Password", true,
                        "Password for the VBC API user."),
                CredentialField.config("accountId", "Account ID", true,
                        "Your VBC account number (e.g. 439357), from admin.commssetup.com → Account."),
                CredentialField.config("tokenUrl", "Token URL", false,
                        "Override the OAuth token endpoint. Leave blank to use the default WSO2 endpoint."),
                CredentialField.config("baseUrl", "API Base URL", false,
                        "Override the API gateway base. Leave blank to use https://api.vonage.com/t/vbc.prod."));
    }
}
