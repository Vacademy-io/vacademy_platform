package vacademy.io.admin_core_service.features.telephony.core;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import vacademy.io.admin_core_service.features.telephony.spi.dto.NormalizedCallEvent;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * In-process pub/sub for call events.
 *
 * Optimisations vs naive impl:
 *   1) Serialise each event to JSON ONCE per publish — not once per
 *      subscriber. Real events on active calls are themselves the heartbeat.
 *   2) Heartbeat only emitters that are STALE (no real event in keepalive
 *      window) — idle calls cost an occasional ping; busy calls cost zero
 *      synthetic traffic on top of their real events. At 1000 concurrent
 *      calls this is the difference between 1000 ping writes every 15s and
 *      ~50.
 *   3) Last-event-on-subscribe — a slow browser opening the EventSource
 *      after the initial QUEUED event still gets state immediately.
 *
 * Multi-pod: a webhook landing on pod A and an SSE subscriber on pod B will
 * miss each other. Documented as a follow-up — the SPI is intact, only the
 * fan-out impl changes (Redis pub/sub keyed on telephony:call:{id}).
 */
@Component
public class CallEventBus {

    private static final Logger log = LoggerFactory.getLogger(CallEventBus.class);

    private static final class Subscription {
        final SseEmitter emitter;
        volatile long lastSentNanos;
        Subscription(SseEmitter emitter) {
            this.emitter = emitter;
            this.lastSentNanos = System.nanoTime();
        }
    }

    private final ConcurrentHashMap<String, CopyOnWriteArrayList<Subscription>> subsByCallId =
            new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, NormalizedCallEvent> lastEventByCallId =
            new ConcurrentHashMap<>();

    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "telephony-sse-heartbeat");
                t.setDaemon(true);
                return t;
            });

    @Autowired private ObjectMapper objectMapper;

    @Value("${telephony.sse.keepalive-seconds:15}")
    private int keepaliveSeconds;

    @Value("${telephony.sse.max-stream-seconds:600}")
    private long maxStreamSeconds;

    public CallEventBus() {
        // Pulse every 5s; only writes to emitters that haven't seen activity
        // in `keepaliveSeconds`. The 5s pulse is bookkeeping; the actual
        // network IO is bounded by how many connections are genuinely idle.
        scheduler.scheduleAtFixedRate(this::heartbeatIdle, 5, 5, TimeUnit.SECONDS);
    }

    @PreDestroy
    public void shutdown() {
        scheduler.shutdownNow();
        subsByCallId.values().forEach(list ->
                list.forEach(s -> { try { s.emitter.complete(); } catch (Exception ignored) {} }));
        subsByCallId.clear();
    }

    public SseEmitter subscribe(String callLogId) {
        SseEmitter emitter = new SseEmitter(maxStreamSeconds * 1000L);
        Subscription sub = new Subscription(emitter);
        CopyOnWriteArrayList<Subscription> list = subsByCallId
                .computeIfAbsent(callLogId, k -> new CopyOnWriteArrayList<>());
        list.add(sub);

        emitter.onCompletion(() -> remove(callLogId, sub));
        emitter.onTimeout(() -> remove(callLogId, sub));
        emitter.onError(t -> remove(callLogId, sub));

        NormalizedCallEvent last = lastEventByCallId.get(callLogId);
        if (last != null) {
            try {
                sendJson(sub, objectMapper.writeValueAsString(last), callLogId);
            } catch (JsonProcessingException e) {
                log.warn("subscribe: failed to send last event for {}", callLogId, e);
            }
        }
        return emitter;
    }

    public void publish(String callLogId, NormalizedCallEvent ev) {
        lastEventByCallId.put(callLogId, ev);
        CopyOnWriteArrayList<Subscription> list = subsByCallId.get(callLogId);
        int subCount = list == null ? 0 : list.size();
        log.info("eventBus.publish callLogId={} status={} terminal={} subscribers={}",
                callLogId, ev.getStatus(), ev.isTerminal(), subCount);
        if (list == null || list.isEmpty()) {
            if (ev.isTerminal()) {
                lastEventByCallId.remove(callLogId);
            }
            return;
        }
        String json;
        try {
            json = objectMapper.writeValueAsString(ev);
        } catch (JsonProcessingException e) {
            log.warn("publish: failed to serialise call event for {}", ev.getCorrelationId(), e);
            return;
        }
        for (Subscription sub : list) {
            sendJson(sub, json, callLogId);
            // On terminal, give the send a brief moment to flush before we
            // complete the emitter — Tomcat/SseEmitter can otherwise close the
            // underlying socket before the final SSE frame has been written,
            // which is exactly the symptom that leaves the browser stuck on
            // "Live updates lost · call still in progress" even though the
            // server-side row reached COMPLETED.
            if (ev.isTerminal()) {
                try {
                    Thread.sleep(50);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
                try {
                    sub.emitter.complete();
                } catch (Exception ignored) {
                }
            }
        }
        if (ev.isTerminal()) {
            subsByCallId.remove(callLogId);
            lastEventByCallId.remove(callLogId);
        }
    }

    private void sendJson(Subscription sub, String json, String callLogId) {
        try {
            sub.emitter.send(SseEmitter.event().name("status").data(json));
            sub.lastSentNanos = System.nanoTime();
        } catch (IOException | IllegalStateException e) {
            log.warn("SSE send dropped for callLogId={}: {}", callLogId, e.getMessage());
        }
    }

    private void remove(String callLogId, Subscription sub) {
        CopyOnWriteArrayList<Subscription> list = subsByCallId.get(callLogId);
        if (list != null) {
            list.remove(sub);
            if (list.isEmpty()) subsByCallId.remove(callLogId);
        }
    }

    private void heartbeatIdle() {
        long thresholdNanos = TimeUnit.SECONDS.toNanos(keepaliveSeconds);
        long now = System.nanoTime();
        for (CopyOnWriteArrayList<Subscription> list : subsByCallId.values()) {
            for (Subscription sub : list) {
                if (now - sub.lastSentNanos < thresholdNanos) continue;
                try {
                    sub.emitter.send(SseEmitter.event().name("ping").data("keepalive"));
                    sub.lastSentNanos = now;
                } catch (Exception ignored) { /* dropped — GC via callbacks */ }
            }
        }
    }
}
