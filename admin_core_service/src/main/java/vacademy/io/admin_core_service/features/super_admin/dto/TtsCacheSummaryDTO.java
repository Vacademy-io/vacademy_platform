package vacademy.io.admin_core_service.features.super_admin.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * TTS speech-cache monitoring: fleet totals plus a per-day series.
 *
 * <p>Read entirely from {@code ai_call_result.diagnostics}, which the voice bot
 * posts with every call. Deliberately NOT from the bot's own ledger: the ledger
 * is a current-state snapshot on one box's disk with no history, so it can say
 * what is cached today but never what the hit rate was last Tuesday. Postgres has
 * one row per call going back as far as the calls do, which is what a series
 * needs.
 *
 * <p>NULL, never zero, wherever the cache was not measured — a day on which no
 * agent had the cache on is not a day with a 0% hit rate, and a chart that
 * conflates those reports a rollout that never happened as one that failed.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TtsCacheSummaryDTO {

    /** Calls in range that actually measured the cache (its counters were armed). */
    private long measuredCalls;
    /** Calls in range whose agent had the cache off, for context on coverage. */
    private long unmeasuredCalls;

    private Long hits;
    private Long misses;
    /** Percentage, 0-100. Null when nothing was attempted — a rate over zero
     *  attempts is not a zero rate. */
    private Double hitRate;
    private Long charsSaved;
    private Double secsSaved;
    /** Rupees kept off the TTS bill, priced per engine. Excludes engines with no
     *  confirmed per-minute cost. */
    private Double inrSaved;

    /** Per-engine hits, so it is obvious which engine is carrying the saving. */
    private Map<String, Long> hitsByEngine;

    /** Oldest day first, one entry per day that had at least one measured call. */
    private List<Day> series;

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Day {
        /** ISO date, yyyy-MM-dd. */
        private String day;
        private long measuredCalls;
        private long hits;
        private long misses;
        /** Percentage, 0-100. Null when the day attempted nothing. */
        private Double hitRate;
        private long charsSaved;
        private double inrSaved;
    }
}
