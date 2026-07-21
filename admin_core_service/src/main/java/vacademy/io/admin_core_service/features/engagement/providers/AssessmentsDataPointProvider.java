package vacademy.io.admin_core_service.features.engagement.providers;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.engagement.client.EngagementInternalClients;
import vacademy.io.admin_core_service.features.engagement.spi.DataPointProvider;
import vacademy.io.admin_core_service.features.engagement.spi.DataPointSpec;
import vacademy.io.admin_core_service.features.engagement.spi.FetchContext;
import vacademy.io.admin_core_service.features.engagement.spi.Subject;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Assessment history via the batched internal endpoint (assessment_service).
 * HIGH sensitivity: piping a learner's scores into an LLM that writes to their parent is a
 * conversation the institute must opt into (wizard consent checkbox).
 */
@Component
@RequiredArgsConstructor
public class AssessmentsDataPointProvider implements DataPointProvider {

    private final EngagementInternalClients clients;

    @Override public String key() { return "assessments"; }
    @Override public boolean alwaysOn() { return false; }

    @Override
    public DataPointSpec declare() {
        return DataPointSpec.builder()
                .key(key()).label("Assessment attempts + scores")
                .description("Attempt count, last attempt time, average score percentage, last "
                        + "assessment name, within the window. Absence means no attempts in the "
                        + "window (or the subject is a lead with no account).")
                .sensitivity("HIGH").cost("HTTP").build();
    }

    @Override
    public Map<String, JsonNode> fetch(FetchContext ctx, List<Subject> subjects) {
        List<String> userIds = subjects.stream()
                .map(Subject::getUserId).filter(Objects::nonNull).distinct().toList();
        Map<String, JsonNode> out = new HashMap<>();
        if (userIds.isEmpty()) return out;

        JsonNode byUserId = clients
                .assessmentHistoryBatch(ctx.getInstituteId(), userIds, Math.max(ctx.getRecentWindowDays(), 90))
                .path("byUserId");
        for (Subject s : subjects) {
            if (s.getUserId() == null) continue;
            JsonNode summary = byUserId.get(s.getUserId());
            if (summary != null && !summary.isNull()) out.put(s.getMemberId(), summary);
        }
        return out;
    }

    @Override
    public String render(JsonNode p) {
        if (p == null) return "ASSESSMENTS: no attempts in the window.";
        return "ASSESSMENTS: attempts=" + p.path("attemptCount").asLong(0)
                + " lastAt=" + p.path("lastAttemptAt").asText("never")
                + " avgScore=" + (p.hasNonNull("avgPercentage") ? p.get("avgPercentage").asText() + "%" : "not computable")
                + " last=\"" + p.path("lastAssessmentName").asText("?") + "\"";
    }
}
