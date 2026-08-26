package vacademy.io.admin_core_service.features.telephony.queue.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Wire shapes for the AI call queue APIs, kept together because they are small and
 * only ever used as a set.
 */
public final class AiCallQueueDTOs {

    private AiCallQueueDTOs() {}

    /** What an enqueue produced — returned by the manual-call and bulk-campaign paths. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EnqueueResult {
        private String queueItemId;
        /** True when this call created a new queue item; false when one was already pending. */
        private boolean queued;
        /** Items ahead of this one in its own institute's lane (1-based position = ahead + 1). */
        private long aheadInLane;
        /** Rough wait, from the lane's effective slot count and the assumed call length. */
        private long etaMinutes;
        private String message;
    }

    /** One row of the queue view. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QueueItemView {
        private String id;
        private String instituteId;
        /** Display name of the institute, for the cross-institute dashboard. */
        private String instituteName;
        /** The AI agent as a person names it, resolved from campaignId. */
        private String agentName;
        private String provider;
        private String source;
        /** Which throttle profile this call carries: MANUAL, AUTOMATION, BULK_MANUAL... */
        private String callTrigger;
        private int priority;
        private String sourceRef;
        private String status;
        private String statusReason;
        private String responseId;
        private String userId;
        private String phoneNumber;
        private String campaignId;
        private String campaignName;
        private int attempts;
        private String notBefore;
        private String expiresAt;
        private String callLogId;
        private String dispatchedAt;
        private String createdAt;
        /** Only populated for QUEUED rows. */
        private Long aheadInLane;
        private Long etaMinutes;
        /**
         * Live state of the actual call, for rows that have already dialled. The queue's
         * own status stops at DIALED and never moves again, so these three are the only
         * way to tell a call that is on a line right now from one that ended hours ago.
         */
        private String callStatus;
        private Integer callDurationSeconds;
        /** True while the call is still up (non-terminal call-log status). */
        private boolean live;
    }

    /** Institute-facing summary: "how deep is my queue and when will it clear?". */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QueueSummary {
        private String instituteId;
        private long queued;
        private long inFlight;
        /** Slots this institute may occupy at once right now (override, or the dynamic default). */
        private int laneCapacity;
        private boolean paused;
        private int fleetCapacity;
        private int fleetInFlight;
        private long etaMinutes;
        private Map<String, Long> byStatus;
    }

    /** Fleet capacity + live occupancy, for the ops/settings screen. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CapacityView {
        /** Sum of max_concurrent over enabled, non-DOWN boxes. */
        private int vacademyAiCapacity;
        private int vacademyAiInFlight;
        private int aavtaarCapacity;
        private int aavtaarInFlight;
        /** False = the concurrency limit is switched off (emergency lever). */
        private boolean capacityEnabled;
        private long totalQueued;
        private int lanesWithWork;
        /** The cap an institute with no override currently gets. */
        private int dynamicLaneCapacity;
        private int avgCallSeconds;
        private int reservedInteractiveSlots;
        private List<BoxView> boxes;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BoxView {
        private String id;
        private String slug;
        private String baseUrl;
        private int maxConcurrent;
        private int priority;
        private boolean enabled;
        private String healthStatus;
        private Integer activeCalls;
        private String lastHealthCheck;
        private String notes;
        /** False when the box is enabled but known DOWN, i.e. lending no capacity. */
        private boolean countsTowardCapacity;
    }

    /** Create/update payload for a box. */
    @Data
    public static class BoxUpsertRequest {
        private String slug;
        private String baseUrl;
        private Integer maxConcurrent;
        private Integer priority;
        private Boolean enabled;
        private String notes;
    }

    /** Per-institute override payload. {@code maxConcurrent = null} restores the dynamic default. */
    @Data
    public static class LaneUpsertRequest {
        private Integer maxConcurrent;
        private Integer weight;
        private Boolean paused;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LaneView {
        private String instituteId;
        private String instituteName;
        /** Null = no override; the institute follows {@code effectiveMaxConcurrent}. */
        private Integer maxConcurrent;
        private int effectiveMaxConcurrent;
        private int weight;
        private boolean paused;
        private long queued;
        private long inFlight;
        /** Rough time for this lane to clear at its current share of the fleet. */
        private long etaMinutes;
        /** When the longest-waiting item was queued — the number an ops screen watches. */
        private String oldestQueuedAt;
        private String lastDispatchedAt;
    }

    /**
     * The whole AI call queue in one payload — what the fleet can carry, who is holding
     * it, and what is waiting.
     *
     * <p>Assembled from a SINGLE capacity snapshot, so every number in it describes the
     * same instant. Fetching capacity and lanes through separate calls lets a dashboard
     * render an occupancy read at one moment beside lane shares computed at another,
     * which is exactly how "these numbers do not add up" tickets are born.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QueueSnapshot {
        /** When this snapshot was taken (ISO-8601, UTC). */
        private String generatedAt;
        private CapacityView capacity;
        private List<LaneView> lanes;
        /** The head of the queue, in dial order. Bounded — see {@link #waitingTotal}. */
        private List<QueueItemView> waiting;
        /** Everything waiting fleet-wide, so a UI can say "showing 50 of 487". */
        private long waitingTotal;
        /** Fleet-wide counts per lifecycle state (QUEUED / DIALED / FAILED / ...). */
        private Map<String, Long> totalsByStatus;
    }
}
