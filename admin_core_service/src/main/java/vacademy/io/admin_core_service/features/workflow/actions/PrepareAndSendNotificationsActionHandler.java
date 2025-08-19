package vacademy.io.admin_core_service.features.workflow.actions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.util.*;

@Service
@RequiredArgsConstructor
public class PrepareAndSendNotificationsActionHandler implements ActionHandlerService {

    private final NotificationClient notificationClient;
    private final SpelEvaluator spelEvaluator;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String getType() {
        return "prepareAndSendNotifications";
    }

    @Override
    public Map<String, Object> execute(Map<String, Object> item, JsonNode config, Map<String, Object> context) {
        Map<String, Object> out = new HashMap<>();

        List<Map<String, Object>> ssigmList = safeList(context.get("ssigm_list"));
        if (ssigmList.isEmpty())
            return Map.of("success", true);

        boolean sendEmail = evalBoolean(config.path("send_email").asText(null), context, true);
        boolean sendWa = evalBoolean(config.path("send_whatsapp").asText(null), context, true);
        String keyExpr = config.path("key_expr").asText("#{ T(java.lang.String).valueOf(item.remaining_days) }");

        List<Map<String, Object>> emailResults = new ArrayList<>();
        List<Map<String, Object>> waResults = new ArrayList<>();
        if (sendEmail) {
            JsonNode emailMatrix = config.path("email_matrix");
            Map<String, List<Map<String, Object>>> groups = new LinkedHashMap<>();
            for (Map<String, Object> row : ssigmList) {
                String key = String.valueOf(spelEvaluator.eval(keyExpr, withItem(context, row)));
                if (!emailMatrix.has(key) && !emailMatrix.has("DEFAULT"))
                    continue;
                JsonNode variants = emailMatrix.has(key) ? emailMatrix.get(key) : emailMatrix.get("DEFAULT");
                if (variants != null && variants.isArray()) {
                    int idx = 0;
                    for (JsonNode variant : variants) {
                        String gKey = key + "#VAR" + idx++;
                        groups.computeIfAbsent(gKey, k -> new ArrayList<>()).add(row);
                    }
                }
            }
            for (Map.Entry<String, List<Map<String, Object>>> e : groups.entrySet()) {
                String gKey = e.getKey();
                String[] parts = gKey.split("#VAR");
                String key = parts[0];
                int varIdx = Integer.parseInt(parts[1]);
                JsonNode variants = emailMatrix.has(key) ? emailMatrix.get(key) : emailMatrix.get("DEFAULT");
                if (variants == null || !variants.isArray() || variants.get(varIdx) == null)
                    continue;
                JsonNode variant = variants.get(varIdx);
                String subject = variant.path("subject").asText("Aanandham — Update");
                String body = variant.path("body").asText("");

                NotificationDTO batch = new NotificationDTO();
                batch.setNotificationType("EMAIL");
                batch.setSubject(subject);
                batch.setBody(body);
                batch.setSource("WORKFLOW");
                batch.setSourceId(String.valueOf(context.getOrDefault("workflow_id", "wf")));

                List<NotificationToUserDTO> users = new ArrayList<>();
                for (Map<String, Object> u : e.getValue()) {
                    NotificationToUserDTO nu = new NotificationToUserDTO();
                    nu.setUserId(String.valueOf(u.get("user_id")));
                    Map<String, String> ph = new HashMap<>();
                    ph.put("name", String.valueOf(u.getOrDefault("full_name", "User")));
                    ph.put("unique_link", String.valueOf(u.getOrDefault("live_link", "")));
                    ph.put("payment_link", String.valueOf(u.getOrDefault("payment_link", "https://aanandham.app/pay")));
                    ph.put("remaining_days", String.valueOf(u.getOrDefault("remaining_days", "")));
                    nu.setPlaceholders(ph);
                    users.add(nu);
                }
                batch.setUsers(users);
                Map<String, Object> res = notificationClient.sendEmail(batch);
                emailResults.add(res);
            }
        }

        // WHATSAPP: per user using a hardcoded matrix body in config.template.body SPEL
        if (sendWa) {
            JsonNode templateNode = config.path("template").path("body");
            String waExpr = templateNode.isMissingNode() ? null : templateNode.asText(null);
            for (Map<String, Object> row : ssigmList) {
                String body = waExpr == null ? null
                        : String.valueOf(spelEvaluator.eval(waExpr, withItem(context, row)));
                Map<String, Object> res = notificationClient.sendWhatsApp(row, body == null ? "" : body);
                waResults.add(res);
            }
        }

        if (!emailResults.isEmpty())
            out.put("email_results", emailResults);
        if (!waResults.isEmpty())
            out.put("whatsapp_results", waResults);
        out.put("success", true);
        return out;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> safeList(Object o) {
        if (o instanceof List<?> l) {
            List<Map<String, Object>> out = new ArrayList<>();
            for (Object e : l)
                if (e instanceof Map<?, ?> m)
                    out.add((Map<String, Object>) m);
            return out;
        }
        return Collections.emptyList();
    }

    private Map<String, Object> withItem(Map<String, Object> ctx, Map<String, Object> item) {
        Map<String, Object> vars = new HashMap<>(ctx);
        vars.put("item", item);
        return vars;
    }

    private boolean evalBoolean(String expr, Map<String, Object> ctx, boolean dflt) {
        if (expr == null || expr.isBlank())
            return dflt;
        Object v = spelEvaluator.eval(expr, ctx);
        return (v instanceof Boolean b) ? b : Boolean.parseBoolean(String.valueOf(v));
    }
}