package vacademy.io.notification_service.features.email_verification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import vacademy.io.notification_service.features.announcements.dto.EmailConfigDTO;
import vacademy.io.notification_service.features.announcements.service.EmailConfigurationService;
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
 * Regression tests for updateEmailConfiguration after adding upsert semantics.
 * Guards two things: (1) editing an EXISTING sender behaves exactly as before, and
 * (2) editing a not-yet-persisted sender (the virtual support@vacademy.io default)
 * now creates it instead of 404-ing — without disturbing other settings.
 */
class EmailConfigurationUpsertTest {

    private InstituteInternalService institute;
    private EmailAddressMappingRepository mapping;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private EmailConfigurationService service;

    private static final String INSTITUTE_ID = "inst-1";

    @BeforeEach
    void setUp() {
        institute = mock(InstituteInternalService.class);
        mapping = mock(EmailAddressMappingRepository.class);
        service = new EmailConfigurationService(institute, objectMapper, mapping);
    }

    @Test
    void update_existingConfig_stillUpdatesInPlace_noRegression() throws Exception {
        String existing = "{\"setting\":{\"EMAIL_SETTING\":{\"data\":{\"MARKETING_EMAIL\":{"
                + "\"from\":\"Old Name <old@x.com>\",\"host\":\"smtp.gmail.com\",\"port\":587,"
                + "\"username\":\"SMTP_USERNAME\",\"password\":\"SMTP_PASSWORD\"}}}}}";
        when(institute.getInstituteByInstituteId(INSTITUTE_ID))
                .thenReturn(InstituteInfoDTO.builder().id(INSTITUTE_ID).setting(existing).build());
        when(institute.updateInstituteSettings(eq(INSTITUTE_ID), anyString(), any())).thenReturn(true);

        EmailConfigDTO result = service.updateEmailConfiguration(
                INSTITUTE_ID, "MARKETING_EMAIL",
                EmailConfigDTO.builder().email("new@x.com").name("New Name").build(), "tok");

        assertThat(result).isNotNull();
        JsonNode node = capture().path("MARKETING_EMAIL");
        assertThat(node.path("from").asText()).isEqualTo("New Name <new@x.com>");
        // SMTP creds preserved as-is (untouched by an edit)
        assertThat(node.path("username").asText()).isEqualTo("SMTP_USERNAME");
        // Old address demapped, new one mapped
        verify(mapping).deactivateByInstituteIdAndEmailAddress(INSTITUTE_ID, "old@x.com");
        verify(mapping).upsert(anyString(), eq("new@x.com"), eq(INSTITUTE_ID), eq("MARKETING_EMAIL"));
    }

    @Test
    void update_nonExistentType_nowUpserts_insteadOf404() throws Exception {
        // Institute with NO EMAIL_SETTING at all (like the virtual-default case)
        when(institute.getInstituteByInstituteId(INSTITUTE_ID))
                .thenReturn(InstituteInfoDTO.builder().id(INSTITUTE_ID).setting("{}").build());
        when(institute.updateInstituteSettings(eq(INSTITUTE_ID), anyString(), any())).thenReturn(true);

        EmailConfigDTO result = service.updateEmailConfiguration(
                INSTITUTE_ID, "UTILITY_EMAIL",
                EmailConfigDTO.builder().email("neeraj@x.com").name("Neeraj").build(), "tok");

        assertThat(result).isNotNull(); // previously null → 404
        JsonNode node = capture().path("UTILITY_EMAIL");
        assertThat(node.path("from").asText()).isEqualTo("Neeraj <neeraj@x.com>");
        // Seeded placeholder SMTP → routes through the shared SES account
        assertThat(node.path("username").asText()).isEqualTo("SMTP_USERNAME");
        assertThat(node.path("port").asInt()).isEqualTo(587);
        verify(mapping, never()).deactivateByInstituteIdAndEmailAddress(anyString(), anyString());
        verify(mapping).upsert(anyString(), eq("neeraj@x.com"), eq(INSTITUTE_ID), eq("UTILITY_EMAIL"));
    }

    @Test
    void update_upsert_preservesUnrelatedSettings() throws Exception {
        String existing = "{\"setting\":{\"WHATSAPP_SETTING\":{\"keep\":\"me\"},"
                + "\"EMAIL_SETTING\":{\"data\":{}}}}";
        when(institute.getInstituteByInstituteId(INSTITUTE_ID))
                .thenReturn(InstituteInfoDTO.builder().id(INSTITUTE_ID).setting(existing).build());
        when(institute.updateInstituteSettings(eq(INSTITUTE_ID), anyString(), any())).thenReturn(true);

        service.updateEmailConfiguration(
                INSTITUTE_ID, "UTILITY_EMAIL",
                EmailConfigDTO.builder().email("neeraj@x.com").name("Neeraj").build(), "tok");

        JsonNode root = objectMapper.readTree(capturedSettings());
        // Unrelated WHATSAPP_SETTING is untouched
        assertThat(root.path("setting").path("WHATSAPP_SETTING").path("keep").asText()).isEqualTo("me");
        // New email node created alongside it
        assertThat(root.path("setting").path("EMAIL_SETTING").path("data").path("UTILITY_EMAIL")
                .path("from").asText()).isEqualTo("Neeraj <neeraj@x.com>");
    }

    private String capturedSettings() {
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(institute).updateInstituteSettings(eq(INSTITUTE_ID), captor.capture(), any());
        return captor.getValue();
    }

    private JsonNode capture() throws Exception {
        return objectMapper.readTree(capturedSettings())
                .path("setting").path("EMAIL_SETTING").path("data");
    }
}
