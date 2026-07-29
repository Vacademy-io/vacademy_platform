package vacademy.io.admin_core_service.features.institute_pulse.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** On-air classes with turnout, plus the next-N-minutes strip. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstituteLiveClassesResponse {

    private List<LiveClassCard> onAir;

    private List<LiveClassCard> upcoming;

    /** Institute-wide count of on-air classes, NOT the size of the returned page. */
    private long onAirCount;

    /** Institute-wide count of upcoming classes in the lookahead window. */
    private long upcomingCount;

    /** More on-air classes exist beyond the returned slice. */
    private boolean onAirHasMore;

    /** More upcoming classes exist beyond the returned slice. */
    private boolean upcomingHasMore;

    /** Sum of invited across on-air classes. */
    private long invitedNow;

    /** Sum of joined across on-air classes. "Ever joined", not "in the room now". */
    private long joinedNow;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LiveClassCard {
        private String sessionId;
        private String scheduleId;
        private String title;
        private String subject;
        private Long startEpoch;
        private Long endEpoch;
        private String provider;
        private long invited;

        /** Distinct learners who have joined at any point. NOT current occupancy. */
        private long joined;

        private long absent;

        /** joined / invited as a percentage, 0 when nobody is invited. */
        private int turnoutPercent;

        /** False when the window is open but no attendance row exists yet. */
        private boolean started;

        /**
         * Past its scheduled last-entry time but still shown, because classes routinely run over
         * and there is no true end-time in the schema.
         */
        private boolean runningOver;

        /**
         * Live occupancy from the provider — who is in the room RIGHT NOW, as opposed to
         * {@code joined}, which counts everyone who ever joined. Null when the provider has not
         * reported this meeting (non-BBB, or the poller has no data), in which case the UI must
         * not claim to know current occupancy.
         */
        private Integer inRoomNow;

        /** True when the provider reports this meeting as actually running. */
        private boolean providerLive;

        /**
         * True when this provider only reports attendance via a post-hoc sync
         * (Zoom/Google), so the counts are as-of {@code lastSyncEpoch} rather than live.
         * BBB and in-app joins write at join time and are live-accurate.
         */
        private boolean attendanceSynced;

        private Long lastSyncEpoch;
    }
}
