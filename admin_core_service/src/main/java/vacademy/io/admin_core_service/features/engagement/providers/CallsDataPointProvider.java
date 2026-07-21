package vacademy.io.admin_core_service.features.engagement.providers;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.engagement.service.EngagementReadDao;
import vacademy.io.admin_core_service.features.engagement.spi.DataPointProvider;
import vacademy.io.admin_core_service.features.engagement.spi.DataPointSpec;
import vacademy.io.admin_core_service.features.engagement.spi.FetchContext;
import vacademy.io.admin_core_service.features.engagement.spi.Subject;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Phone-call history: "we already called them Tuesday and they asked for a callback". */
@Component
@RequiredArgsConstructor
public class CallsDataPointProvider implements DataPointProvider {

    private final EngagementReadDao dao;
    private final ObjectMapper mapper = new ObjectMapper();

    @Override public String key() { return "calls"; }
    @Override public boolean alwaysOn() { return false; }

    @Override
    public DataPointSpec declare() {
        return DataPointSpec.builder()
                .key(key()).label("Phone call history")
                .description("The most recent phone call (human or AI) to this subject within "
                        + "the window: direction, outcome status, duration. Absence means no "
                        + "calls in the window.")
                .sensitivity("MEDIUM").cost("IN_PROCESS").build();
    }

    /** Match key = last 10 digits (E.164-tolerant); shared by the query and the lookup. */
    private static String last10(String phone) {
        if (phone == null) return null;
        String d = phone.replaceAll("[^0-9]", "");
        if (d.isEmpty()) return null;
        return d.length() <= 10 ? d : d.substring(d.length() - 10);
    }

    @Override
    public Map<String, JsonNode> fetch(FetchContext ctx, List<Subject> subjects) {
        List<String> keys = subjects.stream()
                .map(Subject::getPhone).map(CallsDataPointProvider::last10)
                .filter(Objects::nonNull).distinct().toList();
        Map<String, Object[]> byPhone = dao.latestCallByPhones(
                keys, ctx.getInstituteId(),
                Instant.now().minus(Duration.ofDays(ctx.getRecentWindowDays())));

        Map<String, JsonNode> out = new HashMap<>();
        for (Subject s : subjects) {
            String key = last10(s.getPhone());
            if (key == null) continue;
            Object[] c = byPhone.get(key);
            if (c == null) continue;
            ObjectNode n = mapper.createObjectNode();
            n.put("direction", c[1] != null ? c[1].toString() : null);
            n.put("status", c[2] != null ? c[2].toString() : null);
            n.put("durationSeconds", c[3] != null ? c[3].toString() : null);
            n.put("at", c[4] != null ? c[4].toString() : null);
            out.put(s.getMemberId(), n);
        }
        return out;
    }

    @Override
    public String render(JsonNode p) {
        if (p == null) return "CALLS: none in the window.";
        return "CALLS: last=" + p.path("direction").asText("?") + "/" + p.path("status").asText("?")
                + " duration=" + p.path("durationSeconds").asText("0") + "s at " + p.path("at").asText("?");
    }
}
