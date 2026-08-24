package vacademy.io.admin_core_service.features.perf.dto;

import lombok.Data;

import java.util.List;

/**
 * One minute of real-user latency from a single browser session.
 *
 * The browser has already aggregated per route before sending — this is a summary,
 * not a request log. Field names are short because a sampled fraction of every admin
 * session posts one of these per minute, and the payload is pure overhead for the
 * user who is generating it.
 */
@Data
public class PerfRumReportDTO {

    /** Per-route server timings observed in this minute. */
    private List<RoutePerf> routes;

    /**
     * Round trips of the /v1/perf/ping baseline, in ms. That endpoint does no server
     * work, so these measure the user's connection rather than ours.
     */
    private List<Integer> pings;

    @Data
    public static class RoutePerf {
        /** Templated route key, e.g. "/admin-core-service/v1/users/:id". */
        private String k;

        /** Total responses seen for this route this minute. */
        private Integer n;

        /**
         * Of those, how many carried no Server-Timing header. Reported separately so
         * they are never folded into the histogram as 0ms, which would bias it toward
         * "fast" and flatter us.
         */
        private Integer u;

        /** Server durations in ms, capped client-side. */
        private List<Integer> s;
    }
}
