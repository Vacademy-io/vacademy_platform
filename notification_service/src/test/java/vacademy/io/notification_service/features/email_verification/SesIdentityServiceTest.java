package vacademy.io.notification_service.features.email_verification;

import com.amazonaws.services.simpleemail.AmazonSimpleEmailService;
import com.amazonaws.services.simpleemail.model.GetIdentityVerificationAttributesRequest;
import com.amazonaws.services.simpleemail.model.GetIdentityVerificationAttributesResult;
import com.amazonaws.services.simpleemail.model.IdentityVerificationAttributes;
import com.amazonaws.services.simpleemail.model.VerifyDomainDkimRequest;
import com.amazonaws.services.simpleemail.model.VerifyDomainDkimResult;
import com.amazonaws.services.simpleemail.model.VerifyDomainIdentityRequest;
import com.amazonaws.services.simpleemail.model.VerifyDomainIdentityResult;
import com.amazonaws.services.simpleemail.model.VerifyEmailIdentityRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import vacademy.io.notification_service.features.email_verification.dto.DnsRecordDTO;
import vacademy.io.notification_service.features.email_verification.service.SesIdentityService;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Pure Mockito unit tests (no Spring context) for the SES verification wrapper.
 * Proves status normalization and DNS-record construction without touching AWS.
 */
class SesIdentityServiceTest {

    @SuppressWarnings("unchecked")
    private SesIdentityService serviceWith(AmazonSimpleEmailService ses) {
        ObjectProvider<AmazonSimpleEmailService> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(ses);
        return new SesIdentityService(provider);
    }

    @Test
    void isEnabled_reflectsClientPresence() {
        assertThat(serviceWith(null).isEnabled()).isFalse();
        assertThat(serviceWith(mock(AmazonSimpleEmailService.class)).isEnabled()).isTrue();
    }

    @Test
    void getStatus_mapsSesStatusesToNormalizedValues() {
        AmazonSimpleEmailService ses = mock(AmazonSimpleEmailService.class);
        SesIdentityService service = serviceWith(ses);

        assertThat(statusFor(ses, service, "noreply@x.com", "Success")).isEqualTo("VERIFIED");
        assertThat(statusFor(ses, service, "noreply@x.com", "Pending")).isEqualTo("PENDING");
        assertThat(statusFor(ses, service, "noreply@x.com", "Failed")).isEqualTo("FAILED");
        assertThat(statusFor(ses, service, "noreply@x.com", "TemporaryFailure")).isEqualTo("FAILED");
    }

    @Test
    void getStatus_returnsNotStartedWhenIdentityUnknown() {
        AmazonSimpleEmailService ses = mock(AmazonSimpleEmailService.class);
        SesIdentityService service = serviceWith(ses);
        when(ses.getIdentityVerificationAttributes(any(GetIdentityVerificationAttributesRequest.class)))
                .thenReturn(new GetIdentityVerificationAttributesResult().withVerificationAttributes(Map.of()));

        assertThat(service.getStatus("ghost@x.com")).isEqualTo("NOT_STARTED");
    }

    @Test
    void verifyDomain_buildsOwnershipTxtPlusThreeDkimCnames() {
        AmazonSimpleEmailService ses = mock(AmazonSimpleEmailService.class);
        SesIdentityService service = serviceWith(ses);

        when(ses.verifyDomainIdentity(any(VerifyDomainIdentityRequest.class)))
                .thenReturn(new VerifyDomainIdentityResult().withVerificationToken("owntoken123"));
        when(ses.verifyDomainDkim(any(VerifyDomainDkimRequest.class)))
                .thenReturn(new VerifyDomainDkimResult().withDkimTokens("tok1", "tok2", "tok3"));

        List<DnsRecordDTO> records = service.verifyDomain("myschool.com");

        assertThat(records).hasSize(4);
        // Ownership TXT
        assertThat(records.get(0).getType()).isEqualTo("TXT");
        assertThat(records.get(0).getName()).isEqualTo("_amazonses.myschool.com");
        assertThat(records.get(0).getValue()).isEqualTo("owntoken123");
        // DKIM CNAMEs
        assertThat(records.get(1).getType()).isEqualTo("CNAME");
        assertThat(records.get(1).getName()).isEqualTo("tok1._domainkey.myschool.com");
        assertThat(records.get(1).getValue()).isEqualTo("tok1.dkim.amazonses.com");
        assertThat(records.get(3).getName()).isEqualTo("tok3._domainkey.myschool.com");
    }

    @Test
    void verifyEmailIdentity_delegatesToSes() {
        AmazonSimpleEmailService ses = mock(AmazonSimpleEmailService.class);
        serviceWith(ses).verifyEmailIdentity("noreply@myschool.com");
        verify(ses).verifyEmailIdentity(any(VerifyEmailIdentityRequest.class));
    }

    @Test
    void callsThrowWhenDisabled() {
        SesIdentityService disabled = serviceWith(null);
        try {
            disabled.verifyEmailIdentity("a@b.com");
            assertThat(false).as("expected IllegalStateException").isTrue();
        } catch (IllegalStateException expected) {
            assertThat(expected.getMessage()).contains("not enabled");
        }
    }

    private String statusFor(AmazonSimpleEmailService ses, SesIdentityService service, String identity, String sesStatus) {
        when(ses.getIdentityVerificationAttributes(any(GetIdentityVerificationAttributesRequest.class)))
                .thenReturn(new GetIdentityVerificationAttributesResult().withVerificationAttributes(
                        Map.of(identity, new IdentityVerificationAttributes().withVerificationStatus(sesStatus))));
        return service.getStatus(identity);
    }
}
