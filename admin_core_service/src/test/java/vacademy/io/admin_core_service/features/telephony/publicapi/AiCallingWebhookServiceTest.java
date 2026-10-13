package vacademy.io.admin_core_service.features.telephony.publicapi;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.telephony.publicapi.entity.AiCallApiCall;
import vacademy.io.admin_core_service.features.telephony.publicapi.entity.AiCallWebhook;
import vacademy.io.admin_core_service.features.telephony.publicapi.repository.AiCallApiCallRepository;
import vacademy.io.admin_core_service.features.telephony.publicapi.repository.AiCallWebhookRepository;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AiCallingWebhookServiceTest {

    private AiCallApiCallRepository calls;
    private AiCallWebhookRepository hooks;
    private AiCallingApiViews views;

    @BeforeEach
    void setUp() {
        calls = mock(AiCallApiCallRepository.class);
        hooks = mock(AiCallWebhookRepository.class);
        views = mock(AiCallingApiViews.class);
        when(views.call(any(), anyBoolean())).thenReturn(Map.of("id", "call_1"));
        when(hooks.findById("inst-1")).thenReturn(Optional.of(AiCallWebhook.builder()
                .instituteId("inst-1").url("https://93.184.216.34/hook").secret("whsec_x").enabled(true).build()));
    }

    /** The service with HTTP replaced by a fixed answer. */
    private AiCallingWebhookService service(boolean ok) {
        return new AiCallingWebhookService(calls, hooks, views) {
            @Override
            Delivery deliver(AiCallWebhook w, String eventId, String type, Map<String, Object> data) {
                return new Delivery(ok, ok ? 200 : 500, ok ? null : "HTTP 500");
            }
        };
    }

    private static AiCallApiCall finished(int attempts) {
        return AiCallApiCall.builder().id("call_abc").instituteId("inst-1").agentId("a").phoneNumber("+91")
                .finalEvent("call.completed").webhookStatus("PENDING").webhookAttempts(attempts).build();
    }

    @Test
    void theSignatureIsHmacOfTimestampDotBody() throws Exception {
        String body = "{\"id\":\"evt_1\"}";
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec("whsec_test".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String expected = HexFormat.of().formatHex(mac.doFinal(("1700000000." + body).getBytes(StandardCharsets.UTF_8)));
        assertEquals(expected, AiCallingWebhookService.sign("whsec_test", 1700000000L, body));
        assertNotEquals(expected, AiCallingWebhookService.sign("whsec_test", 1700000001L, body));
    }

    @Test
    void onlyPublicHttpsUrlsAreAccepted() {
        assertEquals("https://93.184.216.34/hook", AiCallingWebhookService.validateUrl("https://93.184.216.34/hook"));
        for (String bad : new String[]{"http://93.184.216.34/hook", "https://127.0.0.1/x", "https://10.0.0.5/x",
                "https://192.168.1.4/x", "https://169.254.169.254/latest", "https://100.64.0.1/x",
                "https://u:p@93.184.216.34/x", "ftp://93.184.216.34/x", "", "not a url"}) {
            assertThrows(AiCallingApiException.class, () -> AiCallingWebhookService.validateUrl(bad), bad);
        }
    }

    @Test
    void aDeliveredEventIsMarkedDelivered() {
        AiCallApiCall c = finished(0);
        service(true).deliverOne(c);
        assertEquals("DELIVERED", c.getWebhookStatus());
        assertEquals(1, c.getWebhookAttempts());
        assertNull(c.getWebhookNextAt());
        assertNotNull(c.getWebhookDeliveredAt());
    }

    @Test
    void failuresRetryOnTheScheduleThenGiveUp() {
        AiCallApiCall c = finished(0);
        Instant before = Instant.now();
        service(false).deliverOne(c);
        assertEquals("PENDING", c.getWebhookStatus());
        assertTrue(c.getWebhookNextAt().isAfter(before.plus(Duration.ofSeconds(50))));
        assertTrue(c.getWebhookNextAt().isBefore(before.plus(Duration.ofSeconds(70))));
        assertEquals(500, c.getWebhookLastCode());

        AiCallApiCall last = finished(AiCallingWebhookService.RETRY_AFTER.size());
        service(false).deliverOne(last);
        assertEquals("FAILED", last.getWebhookStatus());
        assertNull(last.getWebhookNextAt());
    }

    @Test
    void theEventIdIsStableAcrossRetries() {
        AiCallApiCall c = finished(0);
        assertEquals("evt_abc", AiCallingWebhookService.eventId(c));
        assertEquals(AiCallingWebhookService.eventId(c), AiCallingWebhookService.eventId(finished(3)));
    }

    @Test
    void aCallFinishedWithoutAWebhookIsNotQueuedForDelivery() {
        when(hooks.findById("inst-1")).thenReturn(Optional.empty());
        AiCallApiCall c = AiCallApiCall.builder().id("call_x").instituteId("inst-1").agentId("a").phoneNumber("+91").build();
        when(views.state(c)).thenReturn(new AiCallingApiViews.State("no_answer", true, null, null, null, null, null));
        service(true).finalizeOne(c);
        assertEquals("no_answer", c.getFinalStatus());
        assertEquals("call.not_connected", c.getFinalEvent());
        assertEquals("NONE", c.getWebhookStatus());
        assertNotNull(c.getFinalizedAt());
    }

    @Test
    void aCallStillRunningIsLeftOpen() {
        AiCallApiCall c = AiCallApiCall.builder().id("call_y").instituteId("inst-1").agentId("a").phoneNumber("+91").build();
        when(views.state(c)).thenReturn(new AiCallingApiViews.State("dialing", false, null, null, null, null, null));
        service(true).finalizeOne(c);
        assertNull(c.getFinalizedAt());
        verify(calls, never()).save(any());
    }
}
