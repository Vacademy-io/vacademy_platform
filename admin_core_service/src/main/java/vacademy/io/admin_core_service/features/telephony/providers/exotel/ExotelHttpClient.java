package vacademy.io.admin_core_service.features.telephony.providers.exotel;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import vacademy.io.admin_core_service.features.telephony.spi.dto.BridgeCallRequest;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderCredentials;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;

/**
 * Thin REST adapter for Exotel — the ONLY class that knows Exotel's HTTP
 * shape. All other code stays provider-agnostic.
 */
@Component
public class ExotelHttpClient {

    @Value("${telephony.exotel.base-url:https://api.exotel.com}")
    private String baseUrl;

    @Value("${telephony.request-timeout-ms:8000}")
    private int requestTimeoutMs;

    private RestTemplate restTemplate;

    /**
     * Hard request timeouts so a dead Exotel can't tie up a tomcat worker
     * for the default ~5 minutes. Connect = 3s (fast-fail unreachable).
     * Read = configurable (default 8s — Exotel's published SLA + buffer).
     * The circuit breaker takes over after repeated failures so we don't
     * even reach this point during an outage.
     */
    @jakarta.annotation.PostConstruct
    public void init() {
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(Duration.ofSeconds(3));
        f.setReadTimeout(Duration.ofMillis(requestTimeoutMs));
        this.restTemplate = new RestTemplate(f);
    }

    /**
     * Exotel "Connect Two Numbers" — bridges From and To via the ExoPhone.
     * Returns the JSON envelope; caller picks out CallSid.
     *
     * Docs: https://developer.exotel.com/api/make-a-call-api
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> connect(BridgeCallRequest req, ProviderCredentials creds) {
        URI uri = URI.create(baseUrl + "/v1/Accounts/" + creds.getAccountId() + "/Calls/connect.json");

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        // Defensive trim — admin-pasted ExoPhones / counsellor mobiles can carry
        // stray whitespace that Exotel sometimes accepts and sometimes doesn't.
        form.add("From", trimOrNull(req.getFrom()));
        form.add("To", trimOrNull(req.getTo()));
        form.add("CallerId", trimOrNull(req.getCallerId()));
        form.add("CallType", "trans");
        if (req.isRecord()) form.add("Record", "true");
        if (req.getStatusCallbackUrl() != null) {
            // Exotel's defaults are exactly what we want:
            //   - content type: application/x-www-form-urlencoded (our handler
            //     parses via req.getParameter)
            //   - events: every state transition
            // Adding StatusCallbackContentType / StatusCallbackEvents triggers
            // 340025 ("Invalid Call Parameters") on Connect Two Numbers, so we
            // leave them off.
            form.add("StatusCallback", req.getStatusCallbackUrl());
        }
        if (req.getCorrelationId() != null) {
            // Exotel echoes CustomField back on every status callback — that's
            // how the webhook finds the row even if CallSid hasn't been recorded.
            form.add("CustomField", req.getCorrelationId());
        }

        HttpHeaders headers = basicAuthHeaders(creds);
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        ResponseEntity<Map> resp = restTemplate.exchange(uri,
                HttpMethod.POST,
                new HttpEntity<>(form, headers),
                Map.class);
        return resp.getBody();
    }

    private static String trimOrNull(String s) {
        return s == null ? null : s.trim();
    }

    /**
     * Stream an Exotel recording mp3. Returns the underlying InputStream so the
     * caller can pipe it straight to media_service without buffering on disk.
     */
    public InputStream openRecordingStream(String recordingUrl, ProviderCredentials creds) throws IOException {
        URL url = new URL(recordingUrl);
        URLConnection conn = url.openConnection();
        String basic = Base64.getEncoder().encodeToString(
                (creds.getUsername() + ":" + creds.getPassword())
                        .getBytes(StandardCharsets.UTF_8));
        conn.setRequestProperty("Authorization", "Basic " + basic);
        conn.setConnectTimeout(8_000);
        conn.setReadTimeout(30_000);
        return conn.getInputStream();
    }

    private HttpHeaders basicAuthHeaders(ProviderCredentials creds) {
        HttpHeaders h = new HttpHeaders();
        String basic = Base64.getEncoder().encodeToString(
                (creds.getUsername() + ":" + creds.getPassword())
                        .getBytes(StandardCharsets.UTF_8));
        h.set(HttpHeaders.AUTHORIZATION, "Basic " + basic);
        return h;
    }
}
