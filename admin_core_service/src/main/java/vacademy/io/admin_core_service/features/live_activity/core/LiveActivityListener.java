package vacademy.io.admin_core_service.features.live_activity.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import org.postgresql.PGConnection;
import org.postgresql.PGNotification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.live_activity.config.LiveActivityProperties;
import vacademy.io.admin_core_service.features.live_activity.dto.LiveActivityEvent;
import vacademy.io.admin_core_service.features.live_activity.entity.UserLiveEvent;
import vacademy.io.admin_core_service.features.live_activity.repository.UserLiveEventRepository;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.List;
import java.util.Properties;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Cross-replica delivery. Holds one dedicated Postgres connection per pod doing
 * LISTEN on the live activity channel, and hands every notification to the local
 * {@link LiveActivityBus}.
 *
 * <p><b>Why a dedicated connection and not the pooled DataSource.</b> Every service here
 * connects through PgBouncer in {@code pool_mode = transaction}. NOTIFY is fine that way --
 * it is delivered at commit and needs no session state, which is why the recorder publishes
 * over the ordinary pool. LISTEN is not: it needs the session to persist, and through a
 * transaction pooler it appears to succeed, delivers nothing, and can leave the subscription
 * on a server connection later handed to an unrelated caller. So this connects directly,
 * and refuses to start unless a direct URL is explicitly configured.
 *
 * <p><b>Missed notifications are recoverable.</b> LISTEN is at-most-once: anything published
 * while the connection was down is simply gone from the stream. On every (re)connect this
 * replays rows newer than the last one seen, straight from the table. That hole is only
 * closeable because the events are persisted.
 */
@Component
public class LiveActivityListener {

    private static final Logger log = LoggerFactory.getLogger(LiveActivityListener.class);

    private final LiveActivityProperties properties;
    private final LiveActivityBus bus;
    private final UserLiveEventRepository repository;
    private final ObjectMapper objectMapper;

    private final AtomicBoolean running = new AtomicBoolean(false);
    private volatile boolean active = false;
    private volatile Timestamp lastSeen;
    private Thread worker;

    public LiveActivityListener(LiveActivityProperties properties,
                                LiveActivityBus bus,
                                UserLiveEventRepository repository,
                                ObjectMapper objectMapper) {
        this.properties = properties;
        this.bus = bus;
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    /**
     * True when this replica is genuinely receiving cross-replica notifications. The
     * recorder reads it to decide whether it must also fan out locally: with the listener
     * running the notification reaches every replica including the one that produced the
     * event, so publishing both ways would double-deliver.
     */
    public boolean isActive() {
        return active;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        bus.start();

        if (!properties.isEnabled()) {
            log.info("live activity disabled, listener not started");
            return;
        }
        String url = properties.getDirectDbUrl();
        if (url == null || url.isBlank()) {
            // Safe degradation, and only safe because events are persisted: the row is still
            // written and the page backfill still surfaces it. A misconfigured deployment
            // gets a slower feed, not a wrong one.
            log.warn("live-activity.direct-db-url is not set. Cross-replica push is DISABLED "
                    + "and the live feed will only show events produced by this replica. "
                    + "History and backfill are unaffected.");
            return;
        }
        if (url.contains(":6432")) {
            // Fail loudly rather than silently subscribing to nothing.
            log.error("live-activity.direct-db-url appears to point at PgBouncer ({}). LISTEN is "
                    + "unsupported in transaction pooling mode. Listener NOT started.", url);
            return;
        }

        running.set(true);
        worker = new Thread(this::runLoop, "live-activity-listener");
        worker.setDaemon(true);
        worker.start();
    }

    @PreDestroy
    public void stop() {
        running.set(false);
        active = false;
        if (worker != null) {
            worker.interrupt();
        }
    }

    private void runLoop() {
        while (running.get()) {
            try (Connection connection = openDirectConnection()) {
                try (Statement statement = connection.createStatement()) {
                    statement.execute("LISTEN " + sanitiseChannel(properties.getChannel()));
                }
                active = true;
                log.info("live activity listener connected, LISTEN {}", properties.getChannel());

                // Replay anything published while we were not connected.
                replayMissed();

                PGConnection pgConnection = connection.unwrap(PGConnection.class);
                while (running.get() && !connection.isClosed()) {
                    PGNotification[] notifications =
                            pgConnection.getNotifications(properties.getListener().getPollMillis());
                    if (notifications == null) {
                        continue;
                    }
                    for (PGNotification notification : notifications) {
                        handle(notification.getParameter());
                    }
                }
            } catch (Exception e) {
                active = false;
                if (!running.get()) {
                    return;
                }
                log.warn("live activity listener connection lost, retrying in {}s: {}",
                        properties.getListener().getReconnectDelaySeconds(), e.getMessage());
                sleepBeforeRetry();
            }
        }
        active = false;
    }

    private Connection openDirectConnection() throws Exception {
        Properties props = new Properties();
        if (properties.getDirectDbUsername() != null && !properties.getDirectDbUsername().isBlank()) {
            props.setProperty("user", properties.getDirectDbUsername());
        }
        if (properties.getDirectDbPassword() != null && !properties.getDirectDbPassword().isBlank()) {
            props.setProperty("password", properties.getDirectDbPassword());
        }
        return DriverManager.getConnection(properties.getDirectDbUrl(), props);
    }

    private void handle(String json) {
        try {
            LiveActivityEvent event = objectMapper.readValue(json, LiveActivityEvent.class);
            if (event.getOccurredAtEpochMillis() > 0) {
                Timestamp stamp = new Timestamp(event.getOccurredAtEpochMillis());
                if (lastSeen == null || stamp.after(lastSeen)) {
                    lastSeen = stamp;
                }
            }
            bus.publishLocal(event);
        } catch (Exception e) {
            log.warn("failed to handle live activity notification: {}", e.getMessage());
        }
    }

    /**
     * Replay rows newer than the last one this replica saw. On a cold start there is nothing
     * to replay -- the page backfills from GET /events anyway, so starting from "now" avoids
     * every pod re-broadcasting the entire retention window on a rolling deploy.
     */
    private void replayMissed() {
        if (lastSeen == null) {
            lastSeen = new Timestamp(System.currentTimeMillis());
            return;
        }
        try {
            List<UserLiveEvent> missed =
                    repository.findByOccurredAtGreaterThanOrderByOccurredAtAsc(lastSeen);
            if (missed.isEmpty()) {
                return;
            }
            log.info("live activity listener replaying {} missed event(s)", missed.size());
            for (UserLiveEvent row : missed) {
                bus.publishLocal(LiveActivityEventMapper.toEvent(row, objectMapper));
                if (row.getOccurredAt() != null && row.getOccurredAt().after(lastSeen)) {
                    lastSeen = row.getOccurredAt();
                }
            }
        } catch (Exception e) {
            log.warn("live activity replay failed: {}", e.getMessage());
        }
    }

    private void sleepBeforeRetry() {
        try {
            Thread.sleep(properties.getListener().getReconnectDelaySeconds() * 1000L);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Channel names cannot be bound as parameters in LISTEN, so this is concatenated. Keep it
     * to an identifier-safe charset so a config value can never become injection.
     */
    private String sanitiseChannel(String channel) {
        if (channel == null || !channel.matches("[A-Za-z0-9_]{1,63}")) {
            throw new IllegalArgumentException("Invalid live-activity.channel: " + channel);
        }
        return channel;
    }
}
