package vacademy.io.admin_core_service.features.telephony.spi.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.Builder;
import lombok.Value;

import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * A provider-neutral snapshot of one inbound webhook request, handed to
 * {@code CallWebhookHandler.verify/parse}. Replaces passing the raw
 * {@link HttpServletRequest} — that quietly assumed every provider speaks
 * form-urlencoded params and authenticates via a query token (Exotel's shape).
 *
 * <p>It exposes everything any provider's verification + parsing needs:
 * <ul>
 *   <li>{@link #header(String)} — case-insensitive header lookup (a signed-JSON
 *       provider like Vonage/Airtel reads its signature header here);</li>
 *   <li>{@link #param(String)} / {@link #getParams()} — merged query + form
 *       params (Exotel reads everything here);</li>
 *   <li>{@link #getRawBody()} — the exact bytes as a string, so an HMAC can be
 *       computed over the raw body (re-serialized JSON would fail verification);</li>
 *   <li>{@link #json()} — the body parsed as JSON, for JSON-body providers;</li>
 *   <li>{@link #getRemoteIp()} — client IP (X-Forwarded-For aware) for allowlists.</li>
 * </ul>
 */
@Value
@Builder
public class InboundEnvelope {

    private static final ObjectMapper JSON = new ObjectMapper();

    /** Header name (lower-cased) -> value. */
    Map<String, String> headers;
    /** Merged query-string + form params (first value per key). */
    Map<String, String> params;
    /** Raw request body verbatim (for HMAC / JSON parsing). */
    String rawBody;
    /** Best-effort client IP (first X-Forwarded-For hop, else remote addr). */
    String remoteIp;

    /** Case-insensitive header lookup. */
    public String header(String name) {
        if (name == null || headers == null) return null;
        return headers.get(name.toLowerCase(Locale.ROOT));
    }

    /**
     * Query/form param lookup (equivalent to the old req.getParameter).
     * Exact-match / case-SENSITIVE — unlike {@link #header(String)}. Providers
     * read params by the exact key the provider sends (e.g. Exotel "CallSid").
     */
    public String param(String name) {
        return params == null ? null : params.get(name);
    }

    /** The body parsed as JSON, or null if absent/unparseable. */
    public JsonNode json() {
        if (rawBody == null || rawBody.isBlank()) return null;
        try {
            return JSON.readTree(rawBody);
        } catch (Exception e) {
            return null;
        }
    }

    /** Build an envelope from the servlet request + the already-read body. */
    public static InboundEnvelope from(HttpServletRequest req, String rawBody) {
        Map<String, String> headers = new LinkedHashMap<>();
        Enumeration<String> names = req.getHeaderNames();
        while (names != null && names.hasMoreElements()) {
            String n = names.nextElement();
            headers.put(n.toLowerCase(Locale.ROOT), req.getHeader(n));
        }
        Map<String, String> params = new LinkedHashMap<>();
        req.getParameterMap().forEach((k, v) -> {
            if (v != null && v.length > 0) params.put(k, v[0]);
        });
        String forwarded = req.getHeader("X-Forwarded-For");
        String ip = (forwarded != null && !forwarded.isBlank())
                ? forwarded.split(",")[0].trim()
                : req.getRemoteAddr();
        return InboundEnvelope.builder()
                .headers(headers)
                .params(params)
                .rawBody(rawBody)
                .remoteIp(ip)
                .build();
    }
}
