package vacademy.io.admin_core_service.features.telephony.providers.plivo;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderCredentials;
import vacademy.io.common.exceptions.VacademyException;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Thin REST adapter for Plivo — the ONLY class that knows Plivo's HTTP shape.
 * All other code stays provider-agnostic.
 *
 * <p>Auth: HTTP Basic with the institute subaccount's Auth ID/Token
 * ({@code creds.conf("authId")} / {@code creds.secret("authToken")}). The account
 * path segment is the same Auth ID, so each call is scoped + billed to that
 * subaccount.
 *
 * <p>Hard timeouts (3s connect / configurable read) so a dead Plivo can't tie up a
 * tomcat worker; the circuit breaker takes over after repeated failures.
 */
@Component
public class PlivoHttpClient {

    @Value("${telephony.plivo.base-url:https://api.plivo.com}")
    private String baseUrl;

    @Value("${telephony.request-timeout-ms:8000}")
    private int requestTimeoutMs;

    private RestTemplate restTemplate;

    @jakarta.annotation.PostConstruct
    public void init() {
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(Duration.ofSeconds(3));
        f.setReadTimeout(Duration.ofMillis(requestTimeoutMs));
        this.restTemplate = new RestTemplate(f);
    }

    /**
     * Place an outbound call. For the bridge (counsellor-first) flow {@code to} is
     * the counsellor's phone and {@code answerUrl} returns Plivo XML that dials the
     * lead ({@code <Dial><Number>}); {@code from} is the institute's Plivo caller-ID.
     *
     * <p>Plivo's create-call response is {@code {"message","request_uuid","api_id"}}
     * — the stable {@code call_uuid} arrives on the answer/hangup callbacks, so the
     * adapter correlates by the {@code corr} URL param it bakes into the callbacks
     * (CorrelationStrategy.ECHO_FIELD), not by this response.
     *
     * Docs: https://www.plivo.com/docs/voice/api/call#make-a-call
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> createCall(ProviderCredentials creds, String from, String to,
                                          String answerUrl, String hangupUrl, String ringUrl,
                                          boolean record, String ringTimeoutSeconds) {
        String authId = requireAuthId(creds);
        URI uri = URI.create(baseUrl + "/v1/Account/" + authId + "/Call/");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("from", trimOrNull(from));
        body.put("to", trimOrNull(to));
        body.put("answer_url", answerUrl);
        body.put("answer_method", "POST");
        if (hangupUrl != null) {
            body.put("hangup_url", hangupUrl);
            body.put("hangup_method", "POST");
        }
        if (ringUrl != null) {
            body.put("ring_url", ringUrl);
            body.put("ring_method", "POST");
        }
        if (ringTimeoutSeconds != null) body.put("ring_timeout", ringTimeoutSeconds);
        // Recording on the parent leg; the bridged <Dial> can also record. We record
        // at the dial level (in the answer XML) to capture the two-party audio, so we
        // leave the call-level record flag off here unless explicitly asked.
        if (record) body.put("record", Boolean.TRUE);

        HttpHeaders headers = basicAuthHeaders(creds);
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<Map> resp = restTemplate.exchange(uri, HttpMethod.POST,
                new HttpEntity<>(body, headers), Map.class);
        return resp.getBody();
    }

    /**
     * Fetch the subaccount's current balance + currency for the Settings page.
     * Endpoint: GET /v1/Account/{authId}/ → {"cash_credits","auto_recharge",...}.
     */
    public String getAccountRaw(ProviderCredentials creds) {
        String authId = requireAuthId(creds);
        URI uri = URI.create(baseUrl + "/v1/Account/" + authId + "/");
        HttpHeaders headers = basicAuthHeaders(creds);
        headers.setAccept(java.util.List.of(MediaType.APPLICATION_JSON));
        ResponseEntity<String> resp = restTemplate.exchange(uri, HttpMethod.GET,
                new HttpEntity<>(headers), String.class);
        return resp.getBody();
    }

    /**
     * Stream a Plivo recording mp3. Plivo recording URLs are authenticated with the
     * same Basic credentials. Returns the underlying InputStream so the caller pipes
     * it straight to media_service without buffering on disk.
     */
    public InputStream openRecordingStream(String recordingUrl, ProviderCredentials creds) throws IOException {
        URL url = new URL(recordingUrl);
        URLConnection conn = url.openConnection();
        conn.setRequestProperty("Authorization", "Basic " + basicToken(creds));
        conn.setConnectTimeout(8_000);
        conn.setReadTimeout(30_000);
        return conn.getInputStream();
    }

    private String requireAuthId(ProviderCredentials creds) {
        String authId = creds.conf("authId");
        if (authId == null || authId.isBlank()) {
            throw new VacademyException("Plivo authId is not configured for this institute");
        }
        return authId.trim();
    }

    private HttpHeaders basicAuthHeaders(ProviderCredentials creds) {
        HttpHeaders h = new HttpHeaders();
        h.set(HttpHeaders.AUTHORIZATION, "Basic " + basicToken(creds));
        return h;
    }

    private String basicToken(ProviderCredentials creds) {
        String authId = creds.conf("authId");
        String authToken = creds.secret("authToken");
        return Base64.getEncoder().encodeToString(
                ((authId == null ? "" : authId.trim()) + ":" + (authToken == null ? "" : authToken.trim()))
                        .getBytes(StandardCharsets.UTF_8));
    }

    private static String trimOrNull(String s) {
        return s == null ? null : s.trim();
    }
}
