package vacademy.io.admin_core_service.features.ai_models.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeoutException;

/**
 * Per-model LLM gateway routing for admin_core - the Java side of ai_service's
 * {@code llm_router.py}, reading the same {@code llm.model_routes} platform setting
 * (for example {@code {"z-ai/glm-5.3-flash": "isoquant"}}).
 *
 * OpenRouter stays the default. A model routed to Isoquant goes there only while
 * the key is configured and the gateway is not cooling down after a failure, so a
 * missing key or an Isoquant outage degrades to OpenRouter instead of failing.
 *
 * Callers keep their OpenRouter payload and registry model id; {@link #post} turns
 * the payload into the gateway's shape. Usage must still be recorded and charged
 * under the registry id - that is what ai_models prices.
 */
@Slf4j
@Component
public class LlmGatewayRouter {

    public static final String OPENROUTER = "openrouter";
    public static final String ISOQUANT = "isoquant";

    static final String ROUTES_SETTING_KEY = "llm.model_routes";

    private static final Duration ROUTES_TTL = Duration.ofSeconds(30);
    private static final Duration GATEWAY_COOLDOWN = Duration.ofSeconds(120);

    /**
     * Isoquant's GLM accepts only these, and DEFAULTS TO max when nothing is sent -
     * so a request that says nothing must still say "low".
     */
    private static final List<String> ISOQUANT_EFFORTS = List.of("low", "high", "max");
    private static final String ISOQUANT_DEFAULT_EFFORT = "low";

    /** Statuses where the same request may succeed on OpenRouter. 400 is the request's own fault. */
    private static final Set<Integer> FAILOVER_STATUSES = Set.of(401, 402, 403, 404, 408, 429);

    /** OpenRouter-only request fields a direct gateway would reject or ignore. */
    private static final Set<String> OPENROUTER_ONLY_KEYS = Set.of("reasoning", "provider", "transforms", "models", "route");

    /**
     * @param gateway         OPENROUTER or ISOQUANT
     * @param wireModel       the id the gateway expects (Isoquant uses bare names)
     * @param reasoningEffort effort to send; null sends none
     */
    public record Route(String gateway, String wireModel, String reasoningEffort) {
        public boolean isOpenRouter() {
            return OPENROUTER.equals(gateway);
        }
    }

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final String isoquantApiKey;
    private final WebClient isoquantClient;

    private final Map<String, Long> cooldownUntil = new ConcurrentHashMap<>();
    private volatile Map<String, Route> routes = Collections.emptyMap();
    private volatile long routesLoadedAt = 0L;

    public LlmGatewayRouter(JdbcTemplate jdbcTemplate,
                            ObjectMapper objectMapper,
                            @Value("${isoquant.api.key:}") String isoquantApiKey,
                            @Value("${isoquant.base.url:https://api.isoquant.ai/v1}") String isoquantBaseUrl) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.isoquantApiKey = isoquantApiKey == null ? "" : isoquantApiKey.trim();
        this.isoquantClient = WebClient.builder()
                .baseUrl(isoquantBaseUrl.replaceAll("/+$", ""))
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + this.isoquantApiKey)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                // Zero data retention: learner content must not be kept by the gateway.
                .defaultHeader("Isoquant-ZDR", "required")
                .codecs(c -> c.defaultCodecs().maxInMemorySize(4 * 1024 * 1024))
                .build();
    }

    /**
     * Where a call for this registry model goes right now. Never null: anything
     * unrouted, unconfigured or cooling down resolves to OpenRouter.
     */
    public Route resolve(String modelId) {
        Route route = currentRoutes().get(modelId);
        if (route == null) {
            return new Route(OPENROUTER, modelId, null);
        }
        if (ISOQUANT.equals(route.gateway())) {
            if (isoquantApiKey.isEmpty()) {
                return openRouterFallback(modelId, route);
            }
            Long until = cooldownUntil.get(ISOQUANT);
            if (until != null && until > System.currentTimeMillis()) {
                return openRouterFallback(modelId, route);
            }
        }
        return route;
    }

    /**
     * The OpenRouter leg for a routed model. Keeps the route's effort so a GLM
     * failover does not run at OpenRouter's heavy default reasoning.
     */
    public Route openRouterFallback(String modelId, Route route) {
        return new Route(OPENROUTER, modelId, route == null ? null : route.reasoningEffort());
    }

    /**
     * Send an OpenRouter-shaped chat payload to a non-OpenRouter gateway. The model
     * is swapped for the wire id and reasoning becomes the gateway's effort field.
     */
    public Mono<String> post(Route route, Map<String, Object> openRouterPayload, Duration timeout) {
        if (!ISOQUANT.equals(route.gateway())) {
            return Mono.error(new IllegalArgumentException("No client for gateway " + route.gateway()));
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        openRouterPayload.forEach((k, v) -> {
            if (!OPENROUTER_ONLY_KEYS.contains(k)) {
                payload.put(k, v);
            }
        });
        payload.put("model", route.wireModel());
        if (route.reasoningEffort() != null) {
            payload.put("reasoning_effort", route.reasoningEffort());
        }
        return isoquantClient.post()
                .uri("/chat/completions")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(timeout);
    }

    /**
     * OpenRouter's form of the route's effort, for the failover leg. Returns the
     * payload unchanged when the route carries no effort.
     */
    public static Map<String, Object> withOpenRouterReasoning(Map<String, Object> payload, Route route) {
        if (route == null || route.reasoningEffort() == null) {
            return payload;
        }
        Map<String, Object> copy = new LinkedHashMap<>(payload);
        copy.put("reasoning", Map.of("effort", route.reasoningEffort()));
        return copy;
    }

    /** Stop sending to this gateway for a while; calls resolve to OpenRouter meanwhile. */
    public void coolDown(String gateway, Throwable cause) {
        cooldownUntil.put(gateway, System.currentTimeMillis() + GATEWAY_COOLDOWN.toMillis());
        log.warn("[LLM-Gateway] {} failed ({}); using OpenRouter for {}s",
                gateway, cause.getMessage(), GATEWAY_COOLDOWN.toSeconds());
    }

    /** True when the gateway, not the request, is at fault - worth one try on OpenRouter. */
    public static boolean isGatewayFailure(Throwable error) {
        if (error instanceof WebClientResponseException webError) {
            int status = webError.getStatusCode().value();
            return status >= 500 || FAILOVER_STATUSES.contains(status);
        }
        return error instanceof TimeoutException || error instanceof WebClientRequestException;
    }

    private Map<String, Route> currentRoutes() {
        long now = System.currentTimeMillis();
        if (now - routesLoadedAt < ROUTES_TTL.toMillis()) {
            return routes;
        }
        try {
            List<String> rows = jdbcTemplate.queryForList(
                    "SELECT setting_value::text FROM ai_platform_settings WHERE setting_key = ?",
                    String.class, ROUTES_SETTING_KEY);
            routes = rows.isEmpty() ? Collections.emptyMap() : parseRoutes(rows.get(0), objectMapper);
        } catch (Exception e) {
            // Keep the last good map: a settings read blip must not move traffic.
            log.warn("[LLM-Gateway] Could not read {}: {}", ROUTES_SETTING_KEY, e.getMessage());
        }
        routesLoadedAt = now;
        return routes;
    }

    /**
     * Same grammar as ai_service's parse_routes: {model_id: "gateway"} or
     * {model_id: {"router": "...", "model": "...", "reasoning_effort": "low" | false}}.
     * The jsonb column holds the map either as an object or as a JSON string of it
     * (prod has the string form). Unknown gateways and bad efforts are skipped.
     */
    static Map<String, Route> parseRoutes(String raw, ObjectMapper mapper) {
        if (raw == null || raw.isBlank()) {
            return Collections.emptyMap();
        }
        JsonNode root;
        try {
            root = mapper.readTree(raw);
            if (root != null && root.isTextual()) {
                root = mapper.readTree(root.asText());
            }
        } catch (Exception e) {
            log.error("[LLM-Gateway] {} is not valid JSON; every model stays on OpenRouter", ROUTES_SETTING_KEY);
            return Collections.emptyMap();
        }
        if (root == null || !root.isObject()) {
            return Collections.emptyMap();
        }
        Map<String, Route> out = new HashMap<>();
        Iterator<Map.Entry<String, JsonNode>> fields = root.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> field = fields.next();
            String modelId = field.getKey().trim();
            JsonNode entry = field.getValue();
            String gateway = entry.isTextual() ? entry.asText() : entry.path("router").asText("");
            gateway = gateway.trim().toLowerCase();
            if (OPENROUTER.equals(gateway)) {
                continue;
            }
            if (!ISOQUANT.equals(gateway)) {
                log.warn("[LLM-Gateway] Unknown gateway '{}' for {}; it stays on OpenRouter", gateway, modelId);
                continue;
            }
            String wireModel = entry.path("model").asText("").trim();
            if (wireModel.isEmpty()) {
                wireModel = bareModelId(modelId);
            }
            JsonNode effortNode = entry.path("reasoning_effort");
            String effort;
            if (effortNode.isBoolean() && !effortNode.asBoolean()) {
                effort = null; // model without the parameter
            } else if (effortNode.isTextual()) {
                effort = effortNode.asText().trim().toLowerCase();
                if (!ISOQUANT_EFFORTS.contains(effort)) {
                    log.warn("[LLM-Gateway] Isoquant accepts reasoning_effort {}, not '{}'; {} stays on OpenRouter",
                            ISOQUANT_EFFORTS, effort, modelId);
                    continue;
                }
            } else {
                effort = ISOQUANT_DEFAULT_EFFORT;
            }
            out.put(modelId, new Route(ISOQUANT, wireModel, effort));
        }
        return Collections.unmodifiableMap(out);
    }

    /** "z-ai/glm-5.3-flash:batch" -> "glm-5.3-flash": direct gateways use the bare name. */
    static String bareModelId(String modelId) {
        String id = modelId.contains("/") ? modelId.substring(modelId.indexOf('/') + 1) : modelId;
        int colon = id.indexOf(':');
        return colon >= 0 ? id.substring(0, colon) : id;
    }
}
