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
 * Login activity via the batched, HMAC-guarded auth_service endpoint (NOT the permitAll
 * per-user /analytics/student-login-stats — that one is a known IDOR; never build on it).
 */
@Component
@RequiredArgsConstructor
public class LoginActivityDataPointProvider implements DataPointProvider {

    private final EngagementInternalClients clients;

    @Override public String key() { return "login"; }
    @Override public boolean alwaysOn() { return false; }

    @Override
    public DataPointSpec declare() {
        return DataPointSpec.builder()
                .key(key()).label("Login activity")
                .description("Last login time, login count, and total active minutes within the "
                        + "window. Absence means no logins in the window (or the subject has no "
                        + "account yet).")
                .sensitivity("HIGH").cost("HTTP").build();
    }

    @Override
    public Map<String, JsonNode> fetch(FetchContext ctx, List<Subject> subjects) {
        List<String> userIds = subjects.stream()
                .map(Subject::getUserId).filter(Objects::nonNull).distinct().toList();
        Map<String, JsonNode> out = new HashMap<>();
        if (userIds.isEmpty()) return out;

        JsonNode byUserId = clients.loginStatsBatch(userIds, ctx.getRecentWindowDays()).path("byUserId");
        for (Subject s : subjects) {
            if (s.getUserId() == null) continue;
            JsonNode stats = byUserId.get(s.getUserId());
            if (stats != null && !stats.isNull()) out.put(s.getMemberId(), stats);
        }
        return out;
    }

    @Override
    public String render(JsonNode p) {
        if (p == null) return "LOGIN: no logins in the window.";
        return "LOGIN: lastLogin=" + p.path("lastLoginAt").asText("never")
                + " logins=" + p.path("loginCount").asLong(0)
                + " activeMinutes=" + p.path("totalActivityMinutes").asLong(0);
    }
}
