package vacademy.io.admin_core_service.features.engagement.providers;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
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

/** CRM context: lead status/tier/score, counsellor, recent journey events. */
@Component
@RequiredArgsConstructor
public class CrmLeadDataPointProvider implements DataPointProvider {

    private final EngagementReadDao dao;
    private final ObjectMapper mapper = new ObjectMapper();

    @Override public String key() { return "crm_lead"; }
    @Override public boolean alwaysOn() { return false; }

    @Override
    public DataPointSpec declare() {
        return DataPointSpec.builder()
                .key(key()).label("CRM lead activity")
                .description("Lead pipeline status, tier (HOT/WARM/COLD), score, assigned "
                        + "counsellor, and the latest journey events (status changes, follow-ups, "
                        + "calls). Absent for subjects who are not leads.")
                .sensitivity("MEDIUM").cost("IN_PROCESS").build();
    }

    @Override
    public Map<String, JsonNode> fetch(FetchContext ctx, List<Subject> subjects) {
        List<String> responseIds = subjects.stream()
                .map(Subject::getAudienceResponseId).filter(Objects::nonNull).toList();

        Map<String, Object[]> context = dao.leadContextByResponseIds(responseIds, ctx.getInstituteId());
        // NOTE: recentJourneyByUserIds (timeline_event) is intentionally NOT read here — that table
        // has no institute_id column, so a cross-institute user could surface another institute's
        // journey events. Deferred until timeline_event carries institute (or a scoped anchor).

        Map<String, JsonNode> out = new HashMap<>();
        for (Subject s : subjects) {
            Object[] c = s.getAudienceResponseId() != null ? context.get(s.getAudienceResponseId()) : null;
            if (c == null) continue; // not a lead / no CRM context — absent means absent

            ObjectNode n = mapper.createObjectNode();
            n.put("status", c[1] != null ? c[1].toString() : null);
            n.put("submittedAt", c[2] != null ? c[2].toString() : null);
            n.put("tier", c[3] != null ? c[3].toString() : null);
            n.put("score", c[4] != null ? c[4].toString() : null);
            n.put("counsellor", c[5] != null ? c[5].toString() : null);
            n.put("lastActivityAt", c[6] != null ? c[6].toString() : null);
            out.put(s.getMemberId(), n);
        }
        return out;
    }

    @Override
    public String render(JsonNode p) {
        if (p == null) return "CRM: not a lead / no CRM activity on record.";
        StringBuilder sb = new StringBuilder("CRM: status=").append(p.path("status").asText("?"))
                .append(" tier=").append(p.path("tier").asText("?"))
                .append(" score=").append(p.path("score").asText("?"));
        if (p.hasNonNull("counsellor")) sb.append(" counsellor=").append(p.get("counsellor").asText());
        if (p.hasNonNull("lastActivityAt")) sb.append(" lastActivity=").append(p.get("lastActivityAt").asText());
        JsonNode ev = p.get("recentEvents");
        if (ev != null && ev.size() > 0) {
            sb.append(" | recent: ");
            ev.forEach(e -> sb.append(e.asText()).append("; "));
        }
        return sb.toString();
    }
}
