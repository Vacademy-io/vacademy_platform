package vacademy.io.assessment_service.features.assessment.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.JdkClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * AI credit preview and charging for assessment_service.
 *
 * <p>Two calls, and the difference matters:
 * <ul>
 *   <li>{@link #estimate} is read-only and used to quote a price and check the
 *       balance before doing any work.</li>
 *   <li>{@link #charge} deducts, after the work is delivered and stored.</li>
 * </ul>
 *
 * <p><b>Token counts are deliberately sent as zero.</b> ai_service charges
 * {@code max(parametric, actual_tokens x markup)}. Sending real counts would let
 * the actual half exceed the flat rate the teacher was quoted — at 150
 * credits/USD an expensive model can drift several times above it — so the
 * admin would be shown one number and billed another. With zeros the flat rate
 * IS the price, exactly, and Vacademy absorbs the model-cost variance (trivial
 * at one call per assessment).
 */
@Service
@Slf4j
public class AiServiceCreditClient {

    /** Matches the seeded ai_tool_pricing row and ai_service's DEFAULT_TOOL_PRICING entry. */
    public static final String TOOL_KEY = "assessment_class_ai_report";
    /**
     * Reuses an existing request_type on purpose: a new one fails the
     * ai_token_usage CHECK inside record_usage, which the billing wrapper then
     * swallows — the preview would quote a price and the balance would never move.
     */
    public static final String REQUEST_TYPE = "assessment";

    private final WebClient webClient;
    private final String internalToken;

    public AiServiceCreditClient(
            @Value("${ai.service.base.url:http://ai-service:8077}") String aiServiceBaseUrl,
            @Value("${internal.service.token:${ai.service.internal.token:}}") String internalToken) {
        this.internalToken = internalToken;
        // ai_service runs uvicorn (HTTP/1.1 only); the JDK client's default h2c
        // upgrade probe makes its parser drop the body. Same reason as
        // AiServiceCopyCheckClient.
        HttpClient jdkClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        this.webClient = WebClient.builder()
                .clientConnector(new JdkClientHttpConnector(jdkClient))
                .baseUrl(aiServiceBaseUrl.replaceAll("/$", "") + "/ai-service")
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    /**
     * What this report will cost and whether the institute can afford it.
     *
     * @param sufficient false ONLY when ai_service positively says the balance
     *                   is short. Unknown balance yields null, which callers
     *                   must treat as "allow" — a credit-service blip must not
     *                   block a teacher.
     */
    public record CreditEstimate(BigDecimal credits, BigDecimal currentBalance, Boolean sufficient) {
        public boolean isKnown() {
            return credits != null;
        }
    }

    public CreditEstimate estimate(String instituteId) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("tool_key", TOOL_KEY);
            body.put("params", Map.of());
            body.put("institute_id", instituteId);

            @SuppressWarnings("unchecked")
            Map<String, Object> response = webClient.post()
                    .uri("/credits/v1/estimate-tool")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(Duration.ofSeconds(10));

            if (response == null) return new CreditEstimate(null, null, null);
            return new CreditEstimate(
                    toDecimal(response.get("estimated_credits")),
                    toDecimal(response.get("current_balance")),
                    response.get("sufficient") instanceof Boolean b ? b : null);
        } catch (Exception e) {
            // Fail open: an unreachable credit service must not stop a report.
            log.warn("Could not estimate AI report credits for institute {}: {}", instituteId, e.getMessage());
            return new CreditEstimate(null, null, null);
        }
    }

    /**
     * Deducts the credits for one generated report.
     *
     * <p>Called AFTER the report is stored, and never rethrows — a billing
     * failure must not destroy work the institute can already download. The
     * caller records charge_status so an unbilled report stays reconcilable.
     *
     * <p>The response is deliberately not trusted for success: ai_service
     * returns 200 with {@code success: true} even when the deduction itself
     * failed, because the usage recorder swallows that exception. Only a
     * transport failure or a 5xx is a reliable negative signal.
     *
     * @param idempotencyKey the ANALYSIS ROW id, never the assessment id —
     *                       keying on the assessment makes every later paid
     *                       regenerate a silent zero-credit no-op
     * @return true when the call was accepted (not proof the balance moved)
     */
    public boolean charge(String instituteId, String idempotencyKey, String userId, String model) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("institute_id", instituteId);
            body.put("tool_key", TOOL_KEY);
            body.put("request_type", REQUEST_TYPE);
            body.put("params", Map.of());
            body.put("model", model != null ? model : "system");
            // Zero on purpose — see the class javadoc.
            body.put("prompt_tokens", 0);
            body.put("completion_tokens", 0);
            body.put("idempotency_key", idempotencyKey);
            if (userId != null) body.put("user_id", userId);
            body.put("user_role", "ADMIN");

            webClient.post()
                    .uri("/credits/v1/internal/charge-tool")
                    .header("X-Internal-Service-Token", internalToken)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(Duration.ofSeconds(15));
            return true;
        } catch (Exception e) {
            log.error("AI report generated but NOT charged for institute {} (key {}): {}",
                    instituteId, idempotencyKey, e.getMessage());
            return false;
        }
    }

    private static BigDecimal toDecimal(Object value) {
        if (value == null) return null;
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
