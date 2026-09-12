package vacademy.io.notification_service.features.email_sending_controls;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import vacademy.io.notification_service.features.email_sending_controls.repository.EmailUnsubscribeRepository;
import vacademy.io.notification_service.features.email_sending_controls.service.EmailUnsubscribeService;
import vacademy.io.notification_service.features.email_sending_controls.service.SenderPolicy;
import vacademy.io.notification_service.features.email_sending_controls.service.UnsubscribeMailer;

import java.time.ZoneId;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SendingControlsTest {

    private final ObjectMapper om = new ObjectMapper();

    @Test
    void policyDefaultsAreInert() throws Exception {
        SenderPolicy p = SenderPolicy.from(om.readTree("{\"from\":\"a@b.com\"}"));
        assertFalse(p.capped());
        assertFalse(p.unsubscribeApplies("UTILITY_EMAIL"));
        assertTrue(p.unsubscribeApplies("PROMOTIONAL_EMAIL"), "promotional mail always carries unsubscribe");
        assertNull(SenderPolicy.from(null).postalAddress());
    }

    @Test
    void policyReadsControlsAndToleratesBadZone() throws Exception {
        SenderPolicy p = SenderPolicy.from(om.readTree(
                "{\"max_per_day\":40,\"timezone\":\"America/New_York\",\"send_after_hour\":9,\"postal_address\":\"1 Main St\",\"list_unsubscribe\":true}"));
        assertEquals(40, p.maxPerDay());
        assertEquals(ZoneId.of("America/New_York"), p.zone());
        assertEquals(9, p.sendAfterHour());
        assertTrue(p.unsubscribeApplies("UTILITY_EMAIL"));
        assertTrue(p.nextWindow().isAfter(java.time.LocalDateTime.now()));
        assertEquals(ZoneId.of("UTC"), SenderPolicy.from(om.readTree("{\"timezone\":\"Mars/Olympus\"}")).zone());
        assertEquals("inst|promotional_email|a@b.com", SenderPolicy.senderKey("inst", "PROMOTIONAL_EMAIL", "A@B.com"));
    }

    @Test
    void tokenVerifiesOnlyForSameInstituteAndEmail() throws Exception {
        EmailUnsubscribeService svc = new EmailUnsubscribeService(mock(EmailUnsubscribeRepository.class), "s3cret", "", "https://api.example.com/");
        ReflectionTestUtils.invokeMethod(svc, "init");
        String t = svc.token("inst-1", "Lead@Example.com");
        assertTrue(svc.verify("inst-1", "lead@example.com", t), "case-insensitive email");
        assertFalse(svc.verify("inst-2", "lead@example.com", t));
        assertFalse(svc.verify("inst-1", "other@example.com", t));
        assertFalse(svc.verify("inst-1", "lead@example.com", t.substring(1) + "x"));
        String url = svc.unsubscribeUrl("inst-1", "lead@example.com");
        assertTrue(url.startsWith("https://api.example.com/notification-service/public/v1/email/unsubscribe?i=inst-1&e=lead%40example.com&t="));
    }

    @Test
    void blankBaseUrlFallsBackToGateway() throws Exception {
        // kubectl set env with an unset secret yields "", not an absent variable.
        EmailUnsubscribeService svc = new EmailUnsubscribeService(mock(EmailUnsubscribeRepository.class), "k", "", "");
        ReflectionTestUtils.invokeMethod(svc, "init");
        assertTrue(svc.unsubscribeUrl("i", "x@y.com").startsWith("https://backend-stage.vacademy.io/notification-service/public/v1/email/unsubscribe?"));
    }

    @Test
    void mailerAddsHeadersAndFooter() throws Exception {
        EmailUnsubscribeRepository repo = mock(EmailUnsubscribeRepository.class);
        when(repo.existsByEmailAndInstituteIdAndIsActiveTrue("x@y.com", "i")).thenReturn(false);
        EmailUnsubscribeService svc = new EmailUnsubscribeService(repo, "k", "", "https://api");
        ReflectionTestUtils.invokeMethod(svc, "init");
        UnsubscribeMailer mailer = new UnsubscribeMailer(svc);
        ReflectionTestUtils.setField(mailer, "mailto", "");
        ReflectionTestUtils.setField(mailer, "defaultPostalAddress", "Vacademy, Indore, India");

        MimeMessage m = new MimeMessage(Session.getInstance(new Properties()));
        mailer.addHeaders(m, "i", "x@y.com");
        assertTrue(m.getHeader("List-Unsubscribe")[0].startsWith("<https://api/notification-service/public/v1/email/unsubscribe?"));
        assertEquals("List-Unsubscribe=One-Click", m.getHeader("List-Unsubscribe-Post")[0]);

        SenderPolicy p = SenderPolicy.from(om.readTree("{\"postal_address\":\"12 Elm St, Austin TX\"}"));
        String out = mailer.withFooter("<html><body><p>Hi</p></body></html>", "i", "x@y.com", p, "Riya from Tutezy");
        assertTrue(out.contains("Unsubscribe</a>"));
        assertTrue(out.contains("12 Elm St, Austin TX"), "sender's own address wins over the platform default");
        assertTrue(out.indexOf("Unsubscribe") < out.indexOf("</body>"), "footer goes inside the body");

        String placeholder = mailer.withFooter("<p>Bye <a href=\"{{unsubscribeUrl}}\">opt out</a></p>", "i", "x@y.com", SenderPolicy.NONE, null);
        assertFalse(placeholder.contains("{{unsubscribeUrl}}"));
        assertFalse(placeholder.contains("You received this email"), "template with its own link gets no appended footer");
    }
}
