package vacademy.io.notification_service.features.email_verification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import vacademy.io.notification_service.features.email_verification.dto.SenderVerificationRequest;
import vacademy.io.notification_service.features.email_verification.dto.SenderVerificationResponse;
import vacademy.io.notification_service.features.email_verification.service.EmailSenderVerificationService;
import vacademy.io.notification_service.features.email_verification.service.SesIdentityService;
import vacademy.io.notification_service.features.notification_log.repository.EmailAddressMappingRepository;
import vacademy.io.notification_service.institute.InstituteInfoDTO;
import vacademy.io.notification_service.institute.InstituteInternalService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the verification orchestration: proves it fires the right SES call,
 * writes the correct verification state into EMAIL_SETTING, and flips to VERIFIED on
 * a successful re-check. Uses a real ObjectMapper and mocks the SES + institute I/O.
 */
class EmailSenderVerificationServiceTest {

    private SesIdentityService ses;
    private InstituteInternalService institute;
    private EmailAddressMappingRepository mapping;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private EmailSenderVerificationService service;

    private static final String INSTITUTE_ID = "inst-1";

    @BeforeEach
    void setUp() {
        ses = mock(SesIdentityService.class);
        institute = mock(InstituteInternalService.class);
        mapping = mock(EmailAddressMappingRepository.class);
        service = new EmailSenderVerificationService(ses, institute, mapping, objectMapper);
    }

    @Test
    void verifySender_emailMode_firesSesAndPersistsPendingState() throws Exception {
        when(ses.isEnabled()).thenReturn(true);
        when(institute.getInstituteByInstituteId(INSTITUTE_ID))
                .thenReturn(InstituteInfoDTO.builder().id(INSTITUTE_ID).setting("{}").build());
        when(institute.updateInstituteSettings(eq(INSTITUTE_ID), anyString(), any())).thenReturn(true);

        SenderVerificationRequest req = new SenderVerificationRequest();
        req.setEmail("noreply@myschool.com");
        req.setName("My School");
        req.setType("UTILITY_EMAIL");
        req.setMode("EMAIL");

        SenderVerificationResponse resp = service.verifySender(INSTITUTE_ID, req, "token");

        // SES was asked to verify the single address (not the domain)
        verify(ses).verifyEmailIdentity("noreply@myschool.com");
        verify(ses, never()).verifyDomain(anyString());

        // Response reflects a pending, unverified sender
        assertThat(resp.isEnabled()).isTrue();
        assertThat(resp.getStatus()).isEqualTo("PENDING");
        assertThat(resp.isVerified()).isFalse();
        assertThat(resp.getMode()).isEqualTo("EMAIL");

        // The persisted EMAIL_SETTING node carries the verification state + a usable from-address
        JsonNode node = capturePersistedNode("UTILITY_EMAIL");
        assertThat(node.path("from").asText()).isEqualTo("My School <noreply@myschool.com>");
        assertThat(node.path("verified").asBoolean()).isFalse();
        assertThat(node.path("verification_status").asText()).isEqualTo("PENDING");
        assertThat(node.path("verification_mode").asText()).isEqualTo("EMAIL");
        assertThat(node.path("verification_identity").asText()).isEqualTo("noreply@myschool.com");
        // Placeholder SMTP creds → routes through the shared SES SMTP account
        assertThat(node.path("username").asText()).isEqualTo("SMTP_USERNAME");

        // Inbound-routing mapping kept in sync
        verify(mapping).upsert(anyString(), eq("noreply@myschool.com"), eq(INSTITUTE_ID), eq("UTILITY_EMAIL"));
    }

    @Test
    void getStatus_flipsToVerifiedWhenSesReportsSuccess() throws Exception {
        String existing = "{\"setting\":{\"EMAIL_SETTING\":{\"data\":{\"UTILITY_EMAIL\":{"
                + "\"from\":\"My School <noreply@myschool.com>\","
                + "\"host\":\"smtp.gmail.com\",\"port\":587,\"username\":\"SMTP_USERNAME\",\"password\":\"SMTP_PASSWORD\","
                + "\"verification_mode\":\"EMAIL\",\"verification_identity\":\"noreply@myschool.com\","
                + "\"verification_status\":\"PENDING\",\"verified\":false}}}}}";

        when(ses.isEnabled()).thenReturn(true);
        when(institute.getInstituteByInstituteId(INSTITUTE_ID))
                .thenReturn(InstituteInfoDTO.builder().id(INSTITUTE_ID).setting(existing).build());
        when(institute.updateInstituteSettings(eq(INSTITUTE_ID), anyString(), any())).thenReturn(true);
        when(ses.getStatus("noreply@myschool.com")).thenReturn("VERIFIED");

        SenderVerificationResponse resp = service.getStatus(INSTITUTE_ID, "UTILITY_EMAIL", "token");

        assertThat(resp.getStatus()).isEqualTo("VERIFIED");
        assertThat(resp.isVerified()).isTrue();

        JsonNode node = capturePersistedNode("UTILITY_EMAIL");
        assertThat(node.path("verified").asBoolean()).isTrue();
        assertThat(node.path("verification_status").asText()).isEqualTo("VERIFIED");
        assertThat(node.path("verified_at").isMissingNode()).isFalse();
        // Existing display name preserved, not clobbered
        assertThat(node.path("from").asText()).isEqualTo("My School <noreply@myschool.com>");
    }

    @Test
    void verifySender_returnsDisabledWhenFeatureOff() {
        when(ses.isEnabled()).thenReturn(false);

        SenderVerificationRequest req = new SenderVerificationRequest();
        req.setEmail("noreply@myschool.com");
        req.setType("UTILITY_EMAIL");

        SenderVerificationResponse resp = service.verifySender(INSTITUTE_ID, req, "token");

        assertThat(resp.isEnabled()).isFalse();
        verify(ses, never()).verifyEmailIdentity(anyString());
    }

    /** Grab the last settings JSON persisted and return the given EMAIL_SETTING.data.<type> node. */
    private JsonNode capturePersistedNode(String type) throws Exception {
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(institute).updateInstituteSettings(eq(INSTITUTE_ID), captor.capture(), any());
        return objectMapper.readTree(captor.getValue())
                .path("setting").path("EMAIL_SETTING").path("data").path(type);
    }
}
