package vacademy.io.admin_core_service.features.live_activity.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
@ConfigurationProperties(prefix = "live-activity")
@Data
public class LiveActivityProperties {

    private boolean enabled = true;

    /**
     * JDBC URL for the dedicated LISTEN connection, which MUST bypass PgBouncer.
     *
     * <p>Blank disables the listener entirely and the push becomes replica-local. That is a
     * safe degradation only because events are persisted: the row is still written and the
     * UI's backfill still surfaces it, so a misconfigured deployment gets a slower feed
     * rather than a wrong one.
     *
     * <p>Never point this at PgBouncer. It runs pool_mode=transaction, where LISTEN appears
     * to succeed, delivers nothing, and can leak the subscription onto a shared server
     * connection handed to an unrelated caller.
     */
    private String directDbUrl = "";
    private String directDbUsername = "";
    private String directDbPassword = "";

    private String channel = "live_activity";

    private Sse sse = new Sse();
    private Buffer backfill = new Buffer();
    private Retention retention = new Retention();
    private Listener listener = new Listener();

    @Data
    public static class Sse {
        /**
         * Explicitly set rather than inherited. The telephony equivalents
         * (telephony.sse.keepalive-seconds / max-stream-seconds) are absent from every
         * properties file, so their :15 / :600 code defaults are silently what runs in prod.
         */
        private int keepaliveSeconds = 15;
        private int maxStreamSeconds = 1800;
        private int tokenTtlSeconds = 60;
    }

    @Data
    public static class Buffer {
        private int size = 100;
    }

    @Data
    public static class Listener {
        private int reconnectDelaySeconds = 5;
        private int pollMillis = 500;
    }

    @Data
    public static class Retention {
        private int days = 90;
        private int batchSize = 5000;

        /**
         * Per-category overrides. Call transitions dominate volume and go stale fastest,
         * while payments and enrolments are the rows worth keeping.
         */
        private Map<String, Integer> daysByCategory = new HashMap<>();

        /**
         * Case-insensitive on purpose. Spring's relaxed binding lower-cases map keys coming
         * from a properties file unless they are bracketed, so a literal
         * daysByCategory.get("CALL") would miss the configured value and every category
         * would silently fall back to the global window.
         */
        public int daysFor(String category) {
            if (category == null) {
                return days;
            }
            for (Map.Entry<String, Integer> entry : daysByCategory.entrySet()) {
                if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(category)
                        && entry.getValue() != null) {
                    return entry.getValue();
                }
            }
            return days;
        }
    }
}
