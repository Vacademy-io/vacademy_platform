package vacademy.io.admin_core_service.features.telephony.publicapi;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.servlet.http.HttpServletRequest;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute_api.service.InstituteApiKeyService;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Telleo AI calling API v1. Public base URL https://api.telleo.ai/v1 (ingress rewrite to
 * this path); authenticated with an AI calling API key. JSON is snake_case. Errors use
 * {"error":{"code","message","request_id","details"}} (AiCallingApiErrorAdvice).
 */
@RestController
@RequestMapping("/admin-core-service/open/ai-calling/v1")
@RequiredArgsConstructor
public class PublicAiCallingApiController {

    private final AiCallingApiAuth auth;
    private final AiCallingApiService service;
    private final AiCallingWebhookService webhooks;

    // ── Calls ────────────────────────────────────────────────────────────────────

    @PostMapping("/calls")
    public ResponseEntity<Map<String, Object>> createCall(HttpServletRequest http,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestBody(required = false) CallBody body) {
        var p = auth.authenticate(http, InstituteApiKeyService.SCOPE_CALLS_WRITE);
        if (body == null) throw AiCallingApiException.invalid("Send a JSON body with agent_id and phone_number.");
        Map<String, Object> out = service.createCall(p, body.toInput(body.agentId), body.test, idempotencyKey);
        boolean replay = Boolean.TRUE.equals(out.get("idempotent_replay"));
        return ok(http, replay ? HttpStatus.OK : HttpStatus.CREATED, out);
    }

    @GetMapping("/calls")
    public ResponseEntity<Map<String, Object>> listCalls(HttpServletRequest http,
            @RequestParam(value = "batch_id", required = false) String batchId,
            @RequestParam(value = "external_id", required = false) String externalId,
            @RequestParam(value = "created_after", required = false) String createdAfter,
            @RequestParam(value = "limit", required = false, defaultValue = "25") int limit,
            @RequestParam(value = "starting_after", required = false) String startingAfter) {
        var p = auth.authenticate(http, InstituteApiKeyService.SCOPE_CALLS_READ);
        Instant since = null;
        if (createdAfter != null && !createdAfter.isBlank()) {
            try {
                since = Instant.parse(createdAfter.trim());
            } catch (DateTimeParseException e) {
                throw AiCallingApiException.invalid("created_after must be an ISO-8601 instant, e.g. 2026-10-13T09:00:00Z.");
            }
        }
        return ok(http, HttpStatus.OK, service.listCalls(p, batchId, externalId, since, limit, startingAfter));
    }

    @GetMapping("/calls/{id}")
    public ResponseEntity<Map<String, Object>> getCall(HttpServletRequest http, @PathVariable String id) {
        var p = auth.authenticate(http, InstituteApiKeyService.SCOPE_CALLS_READ);
        return ok(http, HttpStatus.OK, service.getCall(p, id));
    }

    @PostMapping("/calls/{id}/cancel")
    public ResponseEntity<Map<String, Object>> cancel(HttpServletRequest http, @PathVariable String id) {
        var p = auth.authenticate(http, InstituteApiKeyService.SCOPE_CALLS_WRITE);
        return ok(http, HttpStatus.OK, service.cancel(p, id));
    }

    // ── Batches ──────────────────────────────────────────────────────────────────

    @PostMapping("/batches")
    public ResponseEntity<Map<String, Object>> createBatch(HttpServletRequest http,
            @RequestBody(required = false) BatchBody body) {
        var p = auth.authenticate(http, InstituteApiKeyService.SCOPE_CALLS_WRITE);
        if (body == null) throw AiCallingApiException.invalid("Send a JSON body with agent_id and calls.");
        List<AiCallingApiService.CallInput> rows = new ArrayList<>();
        if (body.calls != null) for (CallBody c : body.calls) rows.add(c == null ? null : c.toInput(body.agentId));
        return ok(http, HttpStatus.CREATED, service.createBatch(p, body.agentId, rows, body.test));
    }

    @GetMapping("/batches/{id}")
    public ResponseEntity<Map<String, Object>> getBatch(HttpServletRequest http, @PathVariable String id) {
        var p = auth.authenticate(http, InstituteApiKeyService.SCOPE_CALLS_READ);
        return ok(http, HttpStatus.OK, service.getBatch(p, id));
    }

    // ── Agents ───────────────────────────────────────────────────────────────────

    @GetMapping("/agents")
    public ResponseEntity<Map<String, Object>> agents(HttpServletRequest http) {
        var p = auth.authenticate(http, InstituteApiKeyService.SCOPE_CALLS_READ);
        return ok(http, HttpStatus.OK, service.listAgents(p));
    }

    // ── Webhook ──────────────────────────────────────────────────────────────────

    @GetMapping("/webhook")
    public ResponseEntity<Map<String, Object>> getWebhook(HttpServletRequest http) {
        var p = auth.authenticate(http, InstituteApiKeyService.SCOPE_WEBHOOKS_MANAGE);
        return ok(http, HttpStatus.OK, webhooks.get(p.instituteId()));
    }

    @PutMapping("/webhook")
    public ResponseEntity<Map<String, Object>> putWebhook(HttpServletRequest http,
            @RequestBody(required = false) WebhookBody body) {
        var p = auth.authenticate(http, InstituteApiKeyService.SCOPE_WEBHOOKS_MANAGE);
        return ok(http, HttpStatus.OK, webhooks.put(p.instituteId(), body == null ? null : body.url, "api:" + p.keyId()));
    }

    @PostMapping("/webhook/rotate-secret")
    public ResponseEntity<Map<String, Object>> rotate(HttpServletRequest http) {
        var p = auth.authenticate(http, InstituteApiKeyService.SCOPE_WEBHOOKS_MANAGE);
        return ok(http, HttpStatus.OK, webhooks.rotateSecret(p.instituteId()));
    }

    @PostMapping("/webhook/test")
    public ResponseEntity<Map<String, Object>> testWebhook(HttpServletRequest http) {
        var p = auth.authenticate(http, InstituteApiKeyService.SCOPE_WEBHOOKS_MANAGE);
        return ok(http, HttpStatus.OK, webhooks.sendTest(p.instituteId()));
    }

    @DeleteMapping("/webhook")
    public ResponseEntity<Map<String, Object>> deleteWebhook(HttpServletRequest http) {
        var p = auth.authenticate(http, InstituteApiKeyService.SCOPE_WEBHOOKS_MANAGE);
        webhooks.delete(p.instituteId());
        return ok(http, HttpStatus.OK, Map.of("object", "webhook", "deleted", true));
    }

    private static ResponseEntity<Map<String, Object>> ok(HttpServletRequest http, HttpStatus status,
                                                          Map<String, Object> body) {
        // X-Request-Id is set on every response by RequestTracingFilter.
        return ResponseEntity.status(status)
                .header("Cache-Control", "no-store")
                .body(body);
    }

    // ── Bodies ───────────────────────────────────────────────────────────────────

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ContactBody {
        private String name;
        private String email;
        @JsonProperty("external_id")
        @JsonAlias("externalId")
        private String externalId;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CallBody {
        @JsonProperty("agent_id")
        @JsonAlias("agentId")
        private String agentId;
        @JsonProperty("phone_number")
        @JsonAlias("phoneNumber")
        private String phoneNumber;
        private ContactBody contact;
        private Map<String, Object> variables;
        private Map<String, Object> metadata;
        private boolean test;

        AiCallingApiService.CallInput toInput(String defaultAgentId) {
            return new AiCallingApiService.CallInput(agentId != null ? agentId : defaultAgentId, phoneNumber,
                    contact == null ? null : contact.name, contact == null ? null : contact.email,
                    contact == null ? null : contact.externalId, variables, metadata);
        }
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class BatchBody {
        @JsonProperty("agent_id")
        @JsonAlias("agentId")
        private String agentId;
        private boolean test;
        private List<CallBody> calls;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class WebhookBody {
        private String url;
    }
}
