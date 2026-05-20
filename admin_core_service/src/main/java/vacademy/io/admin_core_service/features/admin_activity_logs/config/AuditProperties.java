package vacademy.io.admin_core_service.features.admin_activity_logs.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "audit")
public class AuditProperties {

    private final Retention retention = new Retention();
    private final Payload payload = new Payload();
    private final Async async = new Async();

    public Retention getRetention() {
        return retention;
    }

    public Payload getPayload() {
        return payload;
    }

    public Async getAsync() {
        return async;
    }

    public static class Retention {
        /** Hard-delete rows older than this many days. */
        private int days = 365;
        /** Rows per chunked DELETE in the retention job. */
        private int batchSize = 5_000;

        public int getDays() {
            return days;
        }

        public void setDays(int days) {
            this.days = days;
        }

        public int getBatchSize() {
            return batchSize;
        }

        public void setBatchSize(int batchSize) {
            this.batchSize = batchSize;
        }
    }

    public static class Payload {
        /** Default cap on serialized JSON size when the annotation doesn't override. */
        private int defaultMaxBytes = 64_000;

        public int getDefaultMaxBytes() {
            return defaultMaxBytes;
        }

        public void setDefaultMaxBytes(int defaultMaxBytes) {
            this.defaultMaxBytes = defaultMaxBytes;
        }
    }

    public static class Async {
        private final Executor executor = new Executor();

        public Executor getExecutor() {
            return executor;
        }

        public static class Executor {
            private int core = 2;
            private int max = 5;
            private int queue = 200;

            public int getCore() {
                return core;
            }

            public void setCore(int core) {
                this.core = core;
            }

            public int getMax() {
                return max;
            }

            public void setMax(int max) {
                this.max = max;
            }

            public int getQueue() {
                return queue;
            }

            public void setQueue(int queue) {
                this.queue = queue;
            }
        }
    }
}
