package vacademy.io.admin_core_service.features.ai_models.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import vacademy.io.admin_core_service.features.ai_models.ModelDefaults;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.BiFunction;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The managed paths of LlmGatewayRouter (chat / callModel) against a local fake of both
 * gateways: Isoquant under /iq/v1, OpenRouter under /or/v1.
 */
class LlmGatewayRouterChatTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String GLM = ModelDefaults.GLM_DEFAULT;
    private static final String GEMINI = ModelDefaults.NON_GLM_FALLBACK;
    private static final String ROUTES = "\"{\\\"z-ai/glm-5.3-flash\\\": \\\"isoquant\\\"}\"";

    /** One request the fake saw. */
    record Seen(String gateway, JsonNode body, String auth) {}

    /** (gateway, request body) -> {status, response body}. */
    private volatile BiFunction<String, JsonNode, Object[]> responder;
    private final List<Seen> seen = new CopyOnWriteArrayList<>();
    private HttpServer server;
    private String base;

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            String gateway = path.startsWith("/iq/") ? "isoquant" : "openrouter";
            JsonNode body = MAPPER.readTree(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            seen.add(new Seen(gateway, body, exchange.getRequestHeaders().getFirst(HttpHeaders.AUTHORIZATION)));
            Object[] reply = responder.apply(gateway, body);
            byte[] out = ((String) reply[1]).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders((Integer) reply[0], out.length);
            exchange.getResponseBody().write(out);
            exchange.close();
        });
        server.start();
        base = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    /** Routes setting + ai_model_defaults rows, both through the one JdbcTemplate. */
    private static JdbcTemplate db(Map<String, String[]> defaults) {
        return new JdbcTemplate() {
            @Override
            @SuppressWarnings("unchecked")
            public <T> List<T> queryForList(String sql, Class<T> elementType, Object... args) {
                return (List<T>) List.of(ROUTES);
            }

            @Override
            public List<Map<String, Object>> queryForList(String sql, Object... args) {
                String[] row = defaults.get((String) args[0]);
                if (row == null) {
                    return List.of();
                }
                Map<String, Object> out = new HashMap<>();
                out.put("default_model_id", row[0]);
                out.put("fallback_model_id", row[1]);
                return List.of(out);
            }
        };
    }

    private LlmGatewayRouter router(Map<String, String[]> defaults, String isoquantKey) {
        JdbcTemplate jdbc = db(defaults);
        return new LlmGatewayRouter(jdbc, MAPPER, new AiModelDefaultsResolver(jdbc),
                isoquantKey, base + "/iq/v1", "or-key", base + "/or/v1");
    }

    private static String completion(String content) {
        return "{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":"
                + (content == null ? "null" : "\"" + content + "\"")
                + "},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":11,\"completion_tokens\":7}}";
    }

    private static Map<String, Object> payload(int maxTokens) {
        Map<String, Object> p = new HashMap<>();
        p.put("model", "ignored/replaced-per-attempt");
        p.put("messages", List.of(Map.of("role", "system", "content", "be brief"),
                Map.of("role", "user", "content", "hi")));
        p.put("max_tokens", maxTokens);
        p.put("usage", Map.of("include", true));
        return p;
    }

    @Test
    void glmOnIsoquantGetsHeadroomLowEffortAndNoOpenRouterKeys() {
        responder = (gw, body) -> new Object[]{200, completion("hello")};
        LlmGatewayRouter router = router(Map.of("chatbot_flow", new String[]{GLM, GEMINI}), "iq-key");

        LlmGatewayRouter.LlmResult result = router.chat("chatbot_flow", payload(500), Duration.ofSeconds(5), null);

        assertEquals(GLM, result.modelId(), "billed under the registry id");
        assertEquals("hello", result.content());
        assertEquals(11, result.promptTokens());
        assertEquals(7, result.completionTokens());
        assertEquals(1, seen.size());
        Seen s = seen.get(0);
        assertEquals("isoquant", s.gateway());
        assertEquals("glm-5.3-flash", s.body().get("model").asText());
        assertEquals("low", s.body().get("reasoning_effort").asText());
        assertEquals(5000, s.body().get("max_tokens").asInt(), "max(500,3000)+min(max(500,2000),12000)");
        assertFalse(s.body().has("reasoning"));
        assertFalse(s.body().has("usage"), "'usage' is OpenRouter-only");
        assertEquals("Bearer iq-key", s.auth());
    }

    @Test
    void gatewayFailureRetriesTheSameModelOnOpenRouterAndCoolsDown() {
        responder = (gw, body) -> "isoquant".equals(gw)
                ? new Object[]{503, "{\"error\":{\"message\":\"overloaded\"}}"}
                : new Object[]{200, completion("from openrouter")};
        LlmGatewayRouter router = router(Map.of(), "iq-key");

        LlmGatewayRouter.LlmResult result = router.chat("admin_agent", payload(16000), Duration.ofSeconds(5), null);

        assertEquals(GLM, result.modelId());
        assertEquals("from openrouter", result.content());
        assertEquals(List.of("isoquant", "openrouter"), seen.stream().map(Seen::gateway).toList());
        JsonNode or = seen.get(1).body();
        assertEquals(GLM, or.get("model").asText(), "same registry model on OpenRouter");
        assertEquals("low", or.path("reasoning").path("effort").asText(), "low on the failover leg too");
        assertEquals(28000, or.get("max_tokens").asInt(), "16000 + 12000");
        assertEquals("Bearer or-key", seen.get(1).auth());
        assertTrue(router.resolve(GLM).isOpenRouter(), "Isoquant cools down after a gateway failure");
    }

    @Test
    void modelErrorMovesToTheNextModelWithItsOwnPayload() {
        responder = (gw, body) -> body.get("model").asText().contains("glm")
                ? new Object[]{400, "{\"error\":{\"message\":\"bad tool schema\"}}"}
                : new Object[]{200, completion("gemini here")};
        LlmGatewayRouter router = router(Map.of("engagement", new String[]{GLM, GEMINI}), "iq-key");

        LlmGatewayRouter.LlmResult result = router.chat("engagement", payload(500), Duration.ofSeconds(5), null);

        assertEquals(GEMINI, result.modelId(), "usage belongs to the model that answered");
        assertEquals(List.of("isoquant", "openrouter"), seen.stream().map(Seen::gateway).toList(),
                "a 400 is the request's fault: no OpenRouter retry of GLM, straight to the next model");
        JsonNode gemini = seen.get(1).body();
        assertEquals(GEMINI, gemini.get("model").asText());
        assertEquals(500, gemini.get("max_tokens").asInt(), "no GLM headroom for other models");
        assertFalse(gemini.has("reasoning"), "no effort unless the caller asks");
        assertFalse(router.resolve(GLM).isOpenRouter(), "a 400 does not cool the gateway down");
    }

    @Test
    void emptyCompletionCountsAsAFailure() {
        responder = (gw, body) -> body.get("model").asText().contains("glm")
                ? new Object[]{200, completion(null)}
                : new Object[]{200, completion("ok")};
        LlmGatewayRouter router = router(Map.of(), "iq-key");
        assertEquals(GEMINI, router.chat("workflow_draft", payload(500), Duration.ofSeconds(5), null).modelId());
    }

    @Test
    void toolCallsWithoutContentAreUsable() {
        String toolReply = "{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":null,"
                + "\"tool_calls\":[{\"id\":\"c1\",\"type\":\"function\",\"function\":{\"name\":\"x\",\"arguments\":\"{}\"}}]},"
                + "\"finish_reason\":\"tool_calls\"}]}";
        responder = (gw, body) -> new Object[]{200, toolReply};
        LlmGatewayRouter.LlmResult result = router(Map.of(), "iq-key")
                .chat("admin_agent", payload(500), Duration.ofSeconds(5), null);
        assertTrue(result.hasToolCalls());
        assertEquals(GLM, result.modelId());
        assertEquals(1, seen.size());
    }

    @Test
    void explicitPickGoesFirstAndCallerEffortIsMappedForIsoquant() {
        responder = (gw, body) -> new Object[]{200, completion("ok")};
        LlmGatewayRouter router = router(Map.of(), "iq-key");
        router.chat(List.of(GLM, GEMINI), payload(32000), Duration.ofSeconds(5), "medium", null);
        JsonNode sent = seen.get(0).body();
        assertEquals("high", sent.get("reasoning_effort").asText(), "Isoquant has no medium");
        assertEquals(44000, sent.get("max_tokens").asInt());
    }

    @Test
    void withoutAnIsoquantKeyGlmGoesToOpenRouterWithLowEffort() {
        responder = (gw, body) -> new Object[]{200, completion("ok")};
        router(Map.of(), "").chat("parent_assistant", payload(500), Duration.ofSeconds(5), null);
        assertEquals("openrouter", seen.get(0).gateway());
        assertEquals("low", seen.get(0).body().path("reasoning").path("effort").asText());
        assertEquals(5000, seen.get(0).body().get("max_tokens").asInt());
    }

    @Test
    void everyModelFailingThrowsWithTheChain() {
        responder = (gw, body) -> new Object[]{400, "{\"error\":{\"message\":\"nope\"}}"};
        LlmGatewayRouter router = router(Map.of(), "iq-key");
        LlmGatewayRouter.LlmChainException e = assertThrows(LlmGatewayRouter.LlmChainException.class,
                () -> router.chat("admin_agent", payload(500), Duration.ofSeconds(5), null));
        assertTrue(e.getMessage().contains(GLM) && e.getMessage().contains(GEMINI), e.getMessage());
    }

    @Test
    void spentBudgetStopsTheWalk() {
        responder = (gw, body) -> new Object[]{400, "{}"};
        LlmGatewayRouter router = router(Map.of(), "iq-key");
        assertThrows(LlmGatewayRouter.LlmChainException.class,
                () -> router.chat(List.of(GLM, GEMINI), payload(500), Duration.ofSeconds(5), null, Duration.ZERO));
        assertTrue(seen.isEmpty());
    }

    @Test
    void headroomAndUserTurnHelpers() {
        assertEquals(16000, LlmGatewayRouter.withReasoningHeadroom(Map.of()).get("max_tokens"),
                "unspecified = 8000 visible + 8000 reasoning");
        assertEquals(5000, LlmGatewayRouter.withReasoningHeadroom(Map.of("max_tokens", 100)).get("max_tokens"));
        assertEquals(24000, LlmGatewayRouter.withReasoningHeadroom(Map.of("max_tokens", 12000)).get("max_tokens"));

        Map<String, Object> systemOnly = Map.of("messages", List.of(Map.of("role", "system", "content", "x")));
        List<?> fixed = (List<?>) LlmGatewayRouter.ensureUserTurn(systemOnly).get("messages");
        assertEquals(2, fixed.size());
        assertEquals("user", ((Map<?, ?>) fixed.get(1)).get("role"));
        Map<String, Object> withUser = payload(1);
        assertTrue(withUser == LlmGatewayRouter.ensureUserTurn(withUser));

        assertEquals("low", LlmGatewayRouter.gatewayEffort("low"));
        assertEquals("high", LlmGatewayRouter.gatewayEffort("medium"));
        assertEquals("max", LlmGatewayRouter.gatewayEffort("MAX"));
        assertEquals("low", LlmGatewayRouter.gatewayEffort("minimal"));
    }
}
