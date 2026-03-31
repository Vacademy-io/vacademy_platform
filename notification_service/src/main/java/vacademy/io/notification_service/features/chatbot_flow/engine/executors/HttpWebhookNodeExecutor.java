package vacademy.io.notification_service.features.chatbot_flow.engine.executors;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import vacademy.io.notification_service.features.chatbot_flow.engine.ChatbotNodeExecutor;
import vacademy.io.notification_service.features.chatbot_flow.engine.FlowExecutionContext;
import vacademy.io.notification_service.features.chatbot_flow.engine.NodeExecutionResult;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowNode;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowSession;
import vacademy.io.notification_service.features.chatbot_flow.enums.ChatbotNodeType;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@Slf4j
@RequiredArgsConstructor
public class HttpWebhookNodeExecutor implements ChatbotNodeExecutor {

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{(.+?)}}");

    @Override
    public boolean canHandle(String nodeType) {
        return ChatbotNodeType.HTTP_WEBHOOK.name().equals(nodeType);
    }

    @Override
    public NodeExecutionResult execute(ChatbotFlowNode node, ChatbotFlowSession session,
                                        String userText, FlowExecutionContext context) {
        Map<String, Object> config = parseConfig(node.getConfig());
        if (config == null) {
            return NodeExecutionResult.builder().success(false).errorMessage("Invalid webhook config").build();
        }

        String url = resolveVariable((String) config.get("url"), context);
        String method = (String) config.getOrDefault("method", "POST");
        String successVariable = (String) config.getOrDefault("successVariable", "webhookResult");

        if (url == null || url.isBlank()) {
            return NodeExecutionResult.builder().success(false).errorMessage("No URL configured").build();
        }

        // SSRF protection: only allow external HTTPS URLs
        if (!isAllowedUrl(url)) {
            log.warn("Blocked webhook URL (SSRF protection): {}", url);
            return NodeExecutionResult.builder()
                    .success(false)
                    .errorMessage("URL not allowed. Only external HTTPS URLs are permitted.")
                    .build();
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            @SuppressWarnings("unchecked")
            Map<String, String> configHeaders = (Map<String, String>) config.get("headers");
            if (configHeaders != null) {
                configHeaders.forEach((k, v) -> headers.set(k, resolveVariable(v, context)));
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) config.get("body");
            Map<String, Object> resolvedBody = resolveBodyVariables(body, context);

            HttpMethod httpMethod = "GET".equalsIgnoreCase(method) ? HttpMethod.GET : HttpMethod.POST;

            // Don't send body on GET requests
            HttpEntity<?> request = httpMethod == HttpMethod.GET
                    ? new HttpEntity<>(headers)
                    : new HttpEntity<>(resolvedBody, headers);

            ResponseEntity<String> response = restTemplate.exchange(url, httpMethod, request, String.class);

            boolean success = response.getStatusCode().is2xxSuccessful();
            Map<String, Object> output = new HashMap<>();
            output.put(successVariable, response.getBody());
            output.put(successVariable + "_status", response.getStatusCode().value());

            log.info("HTTP webhook call: url={}, status={}", url, response.getStatusCode());
            return NodeExecutionResult.builder().success(success).outputVariables(output).build();

        } catch (Exception e) {
            log.error("HTTP webhook failed: url={}, error={}", url, e.getMessage());
            return NodeExecutionResult.builder()
                    .success(false)
                    .errorMessage("Webhook failed: " + e.getMessage())
                    .outputVariables(Map.of(successVariable + "_error", e.getMessage()))
                    .build();
        }
    }

    private Map<String, Object> resolveBodyVariables(Map<String, Object> body, FlowExecutionContext context) {
        if (body == null) return Map.of();
        Map<String, Object> resolved = new HashMap<>();
        for (Map.Entry<String, Object> entry : body.entrySet()) {
            if (entry.getValue() instanceof String) {
                resolved.put(entry.getKey(), resolveVariable((String) entry.getValue(), context));
            } else {
                resolved.put(entry.getKey(), entry.getValue());
            }
        }
        return resolved;
    }

    private String resolveVariable(String template, FlowExecutionContext context) {
        if (template == null) return null;
        Matcher matcher = VARIABLE_PATTERN.matcher(template);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            String varName = matcher.group(1).trim();
            String replacement = "";
            if (varName.startsWith("session.") && context.getSessionVariables() != null) {
                Object val = context.getSessionVariables().get(varName.substring(8));
                replacement = val != null ? val.toString() : "";
            } else if ("phone".equals(varName)) {
                replacement = context.getPhoneNumber() != null ? context.getPhoneNumber() : "";
            } else if ("instituteId".equals(varName)) {
                replacement = context.getInstituteId() != null ? context.getInstituteId() : "";
            } else if (context.getSessionVariables() != null) {
                Object val = context.getSessionVariables().get(varName);
                replacement = val != null ? val.toString() : "";
            }
            matcher.appendReplacement(result, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    /**
     * SSRF protection: resolve hostname to IP then check against blocked ranges.
     * Blocks: private IPs, loopback, link-local, cloud metadata, k8s internal.
     * Resolves DNS first to defeat DNS rebinding and IPv6-mapped addresses.
     */
    private boolean isAllowedUrl(String url) {
        try {
            java.net.URI uri = new java.net.URI(url);
            String scheme = uri.getScheme();
            String host = uri.getHost();

            if (host == null) return false;

            // Must be HTTP or HTTPS
            if (scheme == null || (!scheme.equalsIgnoreCase("https") && !scheme.equalsIgnoreCase("http"))) {
                return false;
            }

            String hostLower = host.toLowerCase();

            // Block internal k8s service names before DNS resolution
            if (hostLower.endsWith(".svc.cluster.local") || hostLower.endsWith(".internal")
                    || hostLower.equals("metadata.google.internal")) {
                return false;
            }

            // Resolve hostname to IP address(es) to defeat DNS rebinding
            java.net.InetAddress[] addresses = java.net.InetAddress.getAllByName(host);
            for (java.net.InetAddress addr : addresses) {
                if (isBlockedAddress(addr)) {
                    return false;
                }
            }

            return true;
        } catch (java.net.UnknownHostException e) {
            log.warn("DNS resolution failed for webhook URL host: {}", url);
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isBlockedAddress(java.net.InetAddress addr) {
        return addr.isLoopbackAddress()        // 127.0.0.0/8, ::1
                || addr.isLinkLocalAddress()    // 169.254.0.0/16, fe80::/10
                || addr.isSiteLocalAddress()    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
                || addr.isAnyLocalAddress()     // 0.0.0.0, ::
                || addr.isMulticastAddress();   // 224.0.0.0/4
    }

    private Map<String, Object> parseConfig(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return null;
        }
    }
}
