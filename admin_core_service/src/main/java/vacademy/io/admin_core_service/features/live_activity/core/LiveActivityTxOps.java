package vacademy.io.admin_core_service.features.live_activity.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.live_activity.config.LiveActivityProperties;
import vacademy.io.admin_core_service.features.live_activity.dto.LiveActivityEvent;
import vacademy.io.admin_core_service.features.live_activity.repository.UserLiveEventRepository;

import java.sql.Timestamp;
import java.util.UUID;

/**
 * The transactional half of recording an event, deliberately in its own bean.
 *
 * <p>This split is not stylistic. Spring's {@code @Transactional} is proxy-based, so a
 * self-invocation from a sibling method on the same class never goes through the proxy and
 * the annotation silently does nothing. That exact trap already produced a long-standing
 * false claim about the admin audit log being a transactional outbox, where the aspect's own
 * {@code @Transactional} was dead code for months. Keeping the annotated method on a
 * separate bean, as {@code CallLifecycleTxOps} and {@code RecordingTxOps} already do in the
 * telephony package, is what makes REQUIRES_NEW real.
 *
 * <p>REQUIRES_NEW matters here because the recorder is called from inside business
 * transactions. Without a genuinely separate transaction, a failed insert could mark the
 * caller rollback-only and take a payment or an enrolment down with it.
 */
@Component
@RequiredArgsConstructor
public class LiveActivityTxOps {

    private static final Logger log = LoggerFactory.getLogger(LiveActivityTxOps.class);

    /** NOTIFY caps payloads at 8000 bytes. Stay well clear of it. */
    private static final int MAX_NOTIFY_PAYLOAD = 7000;

    private final UserLiveEventRepository repository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final LiveActivityProperties properties;

    /**
     * Insert-if-absent, then notify only when this call actually wrote the row.
     *
     * <p>Both statements share one transaction, and Postgres queues notifications until
     * commit. That ordering is what guarantees a subscriber is never told about a row that
     * subsequently rolls back.
     *
     * @return the stamped event when it was newly recorded, or {@code null} when another
     *         replica, a retried webhook or a provider sibling event got there first.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public LiveActivityEvent insertAndNotify(LiveActivityEvent event) {
        long millis = event.getOccurredAtEpochMillis() > 0
                ? event.getOccurredAtEpochMillis()
                : System.currentTimeMillis();
        String id = event.getEventId() != null ? event.getEventId() : UUID.randomUUID().toString();

        int inserted = repository.insertIfAbsent(
                id,
                event.getInstituteId(),
                new Timestamp(millis),
                name(event.getCategory()),
                name(event.getAction()),
                name(event.getActorType()),
                event.getDedupeKey(),
                event.getSubjectName(),
                event.getSubjectEmail(),
                event.getSubjectMobile(),
                event.getSubjectId(),
                event.getEntityId(),
                event.getCounsellorUserId(),
                event.getCounsellorName(),
                serialisePayload(event));

        if (inserted == 0) {
            log.debug("live activity event already recorded, skipping notify: {}",
                    event.getDedupeKey());
            return null;
        }

        LiveActivityEvent stamped = stamp(event, id, millis);
        notifyChannel(stamped, id);
        return stamped;
    }

    private void notifyChannel(LiveActivityEvent stamped, String id) {
        String payload;
        try {
            payload = objectMapper.writeValueAsString(stamped);
        } catch (Exception e) {
            log.warn("live activity notify serialisation failed for {}", id, e);
            return;
        }

        if (payload.length() > MAX_NOTIFY_PAYLOAD) {
            // The complete record is already in the table, so shedding the optional fields
            // beats failing the notification. Listeners still get identity and category,
            // which is everything the feed needs to render the row.
            try {
                payload = objectMapper.writeValueAsString(LiveActivityEvent.builder()
                        .eventId(id)
                        .instituteId(stamped.getInstituteId())
                        .occurredAtEpochMillis(stamped.getOccurredAtEpochMillis())
                        .category(stamped.getCategory())
                        .action(stamped.getAction())
                        .actorType(stamped.getActorType())
                        .dedupeKey(stamped.getDedupeKey())
                        .subjectName(stamped.getSubjectName())
                        .entityId(stamped.getEntityId())
                        .build());
            } catch (Exception e) {
                log.warn("live activity trimmed notify serialisation failed for {}", id, e);
                return;
            }
        }

        try {
            jdbcTemplate.queryForObject("SELECT pg_notify(?, ?)", String.class,
                    properties.getChannel(), payload);
        } catch (Exception e) {
            log.warn("pg_notify failed for live activity event {}: {}", id, e.getMessage());
        }
    }

    private LiveActivityEvent stamp(LiveActivityEvent event, String id, long millis) {
        return LiveActivityEvent.builder()
                .eventId(id)
                .instituteId(event.getInstituteId())
                .occurredAtEpochMillis(millis)
                .category(event.getCategory())
                .action(event.getAction())
                .actorType(event.getActorType())
                .dedupeKey(event.getDedupeKey())
                .subjectName(event.getSubjectName())
                .subjectEmail(event.getSubjectEmail())
                .subjectMobile(event.getSubjectMobile())
                .subjectId(event.getSubjectId())
                .entityId(event.getEntityId())
                .counsellorUserId(event.getCounsellorUserId())
                .counsellorName(event.getCounsellorName())
                .payload(event.getPayload())
                .build();
    }

    private String serialisePayload(LiveActivityEvent event) {
        if (event.getPayload() == null || event.getPayload().isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(event.getPayload());
        } catch (Exception e) {
            log.warn("live activity payload serialisation failed for {}: {}",
                    event.getDedupeKey(), e.getMessage());
            return null;
        }
    }

    private static String name(Enum<?> value) {
        return value == null ? null : value.name();
    }
}
