package vacademy.io.admin_core_service.features.super_admin.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

/**
 * Response shapes for the TTS speech-cache analytics tab.
 *
 * <p>All of it reads {@code tts_cache_entry}, which the voice bot mirrors into
 * Postgres every two minutes (V469). Nothing here talks to the bot, so a screen
 * keeps rendering while the box restarts — and the numbers carry history the
 * bot's own ledger cannot, because that ledger is a current-state snapshot.
 *
 * <p>Freshness is therefore bounded by the push interval. {@code reportedAt} is
 * on every row so the UI can say how stale it is rather than implying live.
 */
public final class TtsCacheDTOs {

    private TtsCacheDTOs() {
    }

    /** Tab landing: one row per agent that has ever contributed to the cache. */
    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Agent {
        private String agentId;
        private String agentName;
        private String instituteId;
        private String instituteName;
        private String engine;
        private String voice;
        /** OFF | FIXED | FULL — the switch, so the tab explains its own zeroes. */
        private String speechCacheMode;

        /** Sentences this agent has cached audio for. */
        private long entries;
        /** Sentences seen but not yet rendered — the "misses" screen's population. */
        private long unrenderedEntries;
        /** Cached entries this agent has never once been served. Dead weight:
         *  paid for, occupying disk, earning nothing. */
        private long neverHitEntries;
        private long bytes;

        private long hits;
        private long sightings;
        /** Percentage 0-100. Null when nothing was ever attempted — a rate over
         *  zero attempts is not a zero rate. */
        private Double hitRate;
        private long charsSaved;
        /** Rupees kept off the TTS bill. Null on engines with no confirmed
         *  per-minute cost, where a hit buys latency rather than money. */
        private Double inrSaved;
        private Date lastHitAt;
        private Date reportedAt;
    }

    /** The sentences screen, and (with {@code reason} set) the misses screen. */
    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Entry {
        private String cacheKey;
        private String sentence;
        private int chars;
        /** A bot-authored line rather than something the LLM produced. The two
         *  answer to different admission rules, so the UI should say which. */
        @com.fasterxml.jackson.annotation.JsonProperty("is_fixed")
        private boolean isFixed;
        private String engine;
        private String voice;

        private int sightings;
        private int hits;
        private boolean rendered;
        private Integer bytes;
        private Integer durationMs;
        private Date firstSeenAt;
        private Date lastSeenAt;
        private Date lastHitAt;

        /** Playable audio for this entry, or null when nothing is rendered yet. */
        private String audioUrl;

        /** Misses screen only: why this sentence is not cached. */
        private String reason;
        /** Misses screen only: rupees spent re-synthesising it so far. */
        private Double inrWasted;
    }

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Page<T> {
        private List<T> content;
        private long totalElements;
        private int page;
        private int pageSize;
    }

    /** What a flush or delete did, or would do on a dry run. */
    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FlushResult {
        private String commandId;
        /** PENDING until the bot claims it. A flush acts on files on the bot's
         *  disk, so it is queued, not immediate — the UI must say "queued". */
        private String status;
        private boolean dryRun;
        private String kind;
        private String agentId;
        private String cacheKey;
        /** Filled in once the bot reports back. Null while PENDING. */
        private Integer entriesRemoved;
        private Long bytesRemoved;
        private String result;
        private Date createdAt;
        private Date finishedAt;
    }
}
