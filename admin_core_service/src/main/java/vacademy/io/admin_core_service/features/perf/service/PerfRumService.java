package vacademy.io.admin_core_service.features.perf.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.perf.dto.PerfRumReportDTO;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Collects real-user latency in memory and flushes it to perf_rum_minute once a
 * minute.
 *
 * The point of this class is to make telemetry about slowness cheap enough that it
 * never becomes a cause of slowness. Its database is a 4-core box that has been
 * OOM-killed by an analytics query before, so:
 *
 *  - Reports arrive already aggregated by the browser, and only from a sampled
 *    fraction of sessions.
 *  - Nothing touches the database on the request path. Ingest is a map update.
 *  - Each pod writes one batched INSERT per minute for whatever it accumulated.
 *
 * WHY THE FLUSH IS DELIBERATELY *NOT* @SchedulerLock'd, unlike every other scheduled
 * job here: the buffer is per-pod, in-process state. A lock would let one pod win and
 * leave the other three pods' measurements to pile up and be discarded — silently
 * losing three quarters of the data. Every pod must flush its own buffer. Duplicate
 * (minute, institute, route) rows across pods are expected and correct; the read side
 * sums bucket counts, which is exactly why histograms are stored instead of
 * percentiles. Retention below IS locked, because a delete only needs to happen once.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class PerfRumService {

    /**
     * Upper bounds in ms, matching V468's documented layout. Index i counts samples
     * with duration <= BOUNDS[i]; the final bucket catches everything slower.
     * Changing these silently reinterprets every historical row — add a column
     * instead.
     */
    private static final int[] BOUNDS = { 50, 100, 250, 500, 1000, 2000, 5000, 10000 };
    private static final int BUCKET_COUNT = BOUNDS.length + 1;

    /** Reserved route_key for the network baseline, which is not a route. */
    private static final String PING_ROUTE = "(ping)";

    private static final String METRIC_SERVER = "server";
    private static final String METRIC_NETWORK = "network";

    /**
     * Hard ceiling on distinct keys held between flushes. A bug in route templating
     * upstream (or a caller inventing route keys) must cost a bounded amount of
     * memory, not the pod. Beyond this, new keys are dropped and counted.
     */
    private static final int MAX_KEYS = 5000;

    /** Defensive caps on a single report — this endpoint is authenticated, not trusted. */
    private static final int MAX_ROUTES_PER_REPORT = 40;
    private static final int MAX_SAMPLES_PER_ROUTE = 200;
    private static final int MAX_PINGS_PER_REPORT = 60;

    private static final int RETENTION_DAYS = 14;

    private final JdbcTemplate jdbcTemplate;

    private final Map<Key, Accumulator> buffer = new ConcurrentHashMap<>();
    private final AtomicLong droppedKeys = new AtomicLong();

    private record Key(Instant bucketStart, String instituteId, String metric, String routeKey) {}

    private static final class Accumulator {
        private final int[] buckets = new int[BUCKET_COUNT];
        private int sampleCount;
        private int unannotatedCount;

        synchronized void add(int durationMs) {
            sampleCount++;
            buckets[bucketIndex(durationMs)]++;
        }

        synchronized void addUnannotated(int count) {
            unannotatedCount += count;
        }

        synchronized int[] snapshotBuckets() {
            return buckets.clone();
        }

        synchronized int samples() { return sampleCount; }

        synchronized int unannotated() { return unannotatedCount; }
    }

    private static int bucketIndex(int durationMs) {
        for (int i = 0; i < BOUNDS.length; i++) {
            if (durationMs <= BOUNDS[i]) {
                return i;
            }
        }
        return BOUNDS.length;
    }

    // ------------------------------------------------------------------
    // Ingest — must stay allocation-light and never touch the database.
    // ------------------------------------------------------------------

    public void record(String instituteId, PerfRumReportDTO report) {
        if (report == null) {
            return;
        }
        Instant bucket = Instant.now().truncatedTo(ChronoUnit.MINUTES);

        List<PerfRumReportDTO.RoutePerf> routes = report.getRoutes();
        if (routes != null) {
            int routeCount = 0;
            for (PerfRumReportDTO.RoutePerf route : routes) {
                if (route == null || route.getK() == null || route.getK().isBlank()) {
                    continue;
                }
                if (++routeCount > MAX_ROUTES_PER_REPORT) {
                    break;
                }
                Accumulator acc = accumulator(bucket, instituteId, METRIC_SERVER, truncate(route.getK()));
                if (acc == null) {
                    continue;
                }
                if (route.getU() != null && route.getU() > 0) {
                    acc.addUnannotated(Math.min(route.getU(), MAX_SAMPLES_PER_ROUTE));
                }
                List<Integer> samples = route.getS();
                if (samples != null) {
                    int taken = 0;
                    for (Integer ms : samples) {
                        if (ms == null || ms < 0 || ++taken > MAX_SAMPLES_PER_ROUTE) {
                            continue;
                        }
                        acc.add(ms);
                    }
                }
            }
        }

        List<Integer> pings = report.getPings();
        if (pings != null) {
            Accumulator acc = accumulator(bucket, instituteId, METRIC_NETWORK, PING_ROUTE);
            if (acc != null) {
                int taken = 0;
                for (Integer ms : pings) {
                    if (ms == null || ms < 0 || ++taken > MAX_PINGS_PER_REPORT) {
                        continue;
                    }
                    acc.add(ms);
                }
            }
        }
    }

    /** Returns null once the buffer is at its ceiling and the key is new. */
    private Accumulator accumulator(Instant bucket, String instituteId, String metric, String routeKey) {
        Key key = new Key(bucket, instituteId, metric, routeKey);
        Accumulator existing = buffer.get(key);
        if (existing != null) {
            return existing;
        }
        if (buffer.size() >= MAX_KEYS) {
            droppedKeys.incrementAndGet();
            return null;
        }
        return buffer.computeIfAbsent(key, k -> new Accumulator());
    }

    /** Renders {1,2,3} — the literal form Postgres accepts for integer[]. */
    private static String toArrayLiteral(int[] values) {
        StringBuilder sb = new StringBuilder(values.length * 4 + 2).append('{');
        for (int i = 0; i < values.length; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(values[i]);
        }
        return sb.append('}').toString();
    }

    private static String truncate(String value) {
        return value.length() <= 255 ? value : value.substring(0, 255);
    }

    // ------------------------------------------------------------------
    // Flush — one batched INSERT per pod per minute. NOT @SchedulerLock'd.
    // ------------------------------------------------------------------

    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    public void flush() {
        if (buffer.isEmpty()) {
            return;
        }

        // Only flush minutes that have closed. The current minute is still
        // accumulating, and writing it now would produce a second row for the same
        // minute on the next tick for no benefit.
        Instant currentBucket = Instant.now().truncatedTo(ChronoUnit.MINUTES);
        List<Object[]> batch = new ArrayList<>();

        for (Map.Entry<Key, Accumulator> entry : buffer.entrySet()) {
            Key key = entry.getKey();
            if (!key.bucketStart().isBefore(currentBucket)) {
                continue;
            }
            // Remove first: anything still arriving for a closed minute belongs to a
            // straggler request and is not worth a second row.
            Accumulator acc = buffer.remove(key);
            if (acc == null) {
                continue;
            }
            int samples = acc.samples();
            int unannotated = acc.unannotated();
            if (samples == 0 && unannotated == 0) {
                continue;
            }
            batch.add(new Object[] {
                    Timestamp.from(key.bucketStart()),
                    key.instituteId(),
                    key.metric(),
                    key.routeKey(),
                    samples,
                    unannotated,
                    // Postgres' JDBC driver will not bind a Java int[] to integer[]
                    // via setObject, so pass the array literal and let the server
                    // cast it. Avoids needing a live Connection to build a
                    // java.sql.Array inside a batch.
                    toArrayLiteral(acc.snapshotBuckets())
            });
        }

        if (batch.isEmpty()) {
            return;
        }

        try {
            jdbcTemplate.batchUpdate(
                    "INSERT INTO perf_rum_minute "
                            + "(bucket_start, institute_id, metric, route_key, sample_count, unannotated_count, buckets) "
                            + "VALUES (?, ?, ?, ?, ?, ?, CAST(? AS integer[]))",
                    batch);
            long dropped = droppedKeys.getAndSet(0);
            if (dropped > 0) {
                log.warn("[perf-rum] buffer ceiling hit — {} keys dropped since last flush", dropped);
            }
        } catch (Exception e) {
            // Losing a minute of sampled telemetry is acceptable. Failing a scheduled
            // job loudly every minute is not, so this stays a single warn.
            log.warn("[perf-rum] flush of {} rows failed: {}", batch.size(), e.getMessage());
        }
    }

    // ------------------------------------------------------------------
    // Retention — locked, because one pod deleting is enough.
    // ------------------------------------------------------------------

    @Scheduled(cron = "0 20 3 * * ?")
    @SchedulerLock(name = "PerfRumRetention", lockAtMostFor = "PT20M", lockAtLeastFor = "PT1M")
    public void purgeOldRows() {
        try {
            int deleted = jdbcTemplate.update(
                    "DELETE FROM perf_rum_minute WHERE bucket_start < now() - CAST(? AS interval)",
                    RETENTION_DAYS + " days");
            if (deleted > 0) {
                log.info("[perf-rum] retention removed {} rows older than {} days", deleted, RETENTION_DAYS);
            }
        } catch (Exception e) {
            log.warn("[perf-rum] retention sweep failed: {}", e.getMessage());
        }
    }
}
