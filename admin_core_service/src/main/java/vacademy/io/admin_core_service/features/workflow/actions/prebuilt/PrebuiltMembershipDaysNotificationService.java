package vacademy.io.admin_core_service.features.workflow.actions.prebuilt;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.workflow.actions.NotificationClient;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.util.*;

@Service
@RequiredArgsConstructor
public class PrebuiltMembershipDaysNotificationService implements PrebuiltActionService {

    private final NotificationClient notificationClient;
    private final SpelEvaluator spelEvaluator;

    @Override
    public String key() {
        return "membership_days_notification";
    }

    @Override
    public Map<String, Object> execute(JsonNode config, Map<String, Object> context) {
        Map<String, Object> out = new HashMap<>();
        List<Map<String, Object>> ssigmList = safeList(context.get("ssigm_list"));
        if (ssigmList.isEmpty())
            return Map.of("success", true);

        boolean sendEmail = evalBoolean(config.path("send_email").asText(null), context, true);
        boolean sendWa = evalBoolean(config.path("send_whatsapp").asText(null), context, true);

        List<Map<String, Object>> emailResults = new ArrayList<>();
        List<Map<String, Object>> waResults = new ArrayList<>();

        // EMAIL: group per remaining_days key and template variant
        if (sendEmail) {
            JsonNode emailMatrix = config.path("email_matrix");
            Map<String, List<Map<String, Object>>> groups = new LinkedHashMap<>();
            for (Map<String, Object> row : ssigmList) {
                String key = String.valueOf(row.get("remaining_days"));
                JsonNode variants = emailMatrix.has(key) ? emailMatrix.get(key) : emailMatrix.get("DEFAULT");
                if (variants == null || !variants.isArray())
                    continue;
                int idx = 0;
                for (JsonNode ignored : variants) {
                    String gKey = key + "#VAR" + idx++;
                    groups.computeIfAbsent(gKey, k -> new ArrayList<>()).add(row);
                }
            }

            for (Map.Entry<String, List<Map<String, Object>>> e : groups.entrySet()) {
                String gKey = e.getKey();
                String[] parts = gKey.split("#VAR");
                String key = parts[0];
                int varIdx = Integer.parseInt(parts[1]);
                JsonNode variants = emailMatrix.has(key) ? emailMatrix.get(key) : emailMatrix.get("DEFAULT");
                if (variants == null || variants.get(varIdx) == null)
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
                    nu.setChannelId(String.valueOf(u.get("email")));
                    Map<String, String> ph = new HashMap<>();
                    ph.put("name", String.valueOf(u.getOrDefault("name", "User")));
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

        // WHATSAPP: per-user SPEL template
        if (sendWa) {
            String waExpr = config.path("template").path("body").asText(null);
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