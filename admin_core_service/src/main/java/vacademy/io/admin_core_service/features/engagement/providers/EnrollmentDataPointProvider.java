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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Enrollment + course progress. Completion % comes straight from the learner_operation
 * rollup (PERCENTAGE_PACKAGE_SESSION_COMPLETED) — precomputed, no math here.
 */
@Component
@RequiredArgsConstructor
public class EnrollmentDataPointProvider implements DataPointProvider {

    private final EngagementReadDao dao;
    private final ObjectMapper mapper = new ObjectMapper();

    @Override public String key() { return "enrollment"; }
    @Override public boolean alwaysOn() { return false; }

    @Override
    public DataPointSpec declare() {
        return DataPointSpec.builder()
                .key(key()).label("Course enrollment + progress")
                .description("Which batches the learner is enrolled in and their completion "
                        + "percentage per batch. Absent for unconverted leads (they have no "
                        + "enrollments) — absence is expected there, not a signal.")
                .sensitivity("LOW").cost("IN_PROCESS").build();
    }

    @Override
    public Map<String, JsonNode> fetch(FetchContext ctx, List<Subject> subjects) {
        List<String> userIds = subjects.stream()
                .map(Subject::getUserId).filter(Objects::nonNull).toList();
        Map<String, List<Object[]>> enrollments = dao.enrollmentsByUserIds(userIds, ctx.getInstituteId());
        Map<String, List<Object[]>> completion = dao.completionByUserIds(userIds);

        Map<String, JsonNode> out = new HashMap<>();
        for (Subject s : subjects) {
            if (s.getUserId() == null) continue;
            List<Object[]> enr = enrollments.get(s.getUserId());
            if (enr == null || enr.isEmpty()) continue;

            // package_session_id → completion% for this user
            Map<String, String> pctBySession = new HashMap<>();
            List<Object[]> comps = completion.getOrDefault(s.getUserId(), List.of());
            for (Object[] c : comps) pctBySession.put((String) c[1], c[2] != null ? c[2].toString() : null);

            ObjectNode n = mapper.createObjectNode();
            ArrayNode arr = n.putArray("enrollments");
            for (Object[] e : enr) {
                ObjectNode one = arr.addObject();
                one.put("packageSessionId", (String) e[1]);
                one.put("status", (String) e[2]);
                one.put("enrolledAt", e[3] != null ? e[3].toString() : null);
                one.put("completionPct", pctBySession.get((String) e[1]));
            }
            out.put(s.getMemberId(), n);
        }
        return out;
    }

    @Override
    public String render(JsonNode p) {
        if (p == null) return "ENROLLMENT: none on record (expected for leads).";
        StringBuilder sb = new StringBuilder("ENROLLMENT:");
        for (JsonNode e : p.path("enrollments")) {
            sb.append(" [batch=").append(e.path("packageSessionId").asText())
              .append(" status=").append(e.path("status").asText())
              .append(" completion=").append(e.hasNonNull("completionPct") ? e.get("completionPct").asText() + "%" : "unknown")
              .append("]");
        }
        return sb.toString();
    }
}
