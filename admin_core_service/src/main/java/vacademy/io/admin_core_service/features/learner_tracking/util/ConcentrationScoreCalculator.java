package vacademy.io.admin_core_service.features.learner_tracking.util;

import java.util.Arrays;
import java.util.Objects;

public class ConcentrationScoreCalculator {

    // A clean activity scores 100; distraction subtracts from it. Rates are
    // per-minute: the old formula normalised counts by activity SECONDS and
    // then multiplied by log(activityLength+1), which pushed essentially every
    // real activity to exactly 100 — the stored metric was a constant.
    //
    // Saturation points (rate at which a component's penalty maxes out):
    //   - 4 pauses/min       → fully distracted on the pause axis
    //   - 2 tab switches/min → fully distracted on the switch axis
    //   - 59 s avg popup response (the popup timeout) → fully distracted on response
    private static final double PAUSE_WEIGHT = 0.5;
    private static final double SWITCH_WEIGHT = 0.3;
    private static final double RESPONSE_WEIGHT = 0.2;
    private static final double PAUSES_PER_MIN_SATURATION = 4.0;
    private static final double SWITCHES_PER_MIN_SATURATION = 2.0;
    private static final double RESPONSE_SECONDS_SATURATION = 59.0;

    public static double calculateConcentrationScore(int pauseCount, int tabSwitchCount, Integer[] answerTimes,
            int activityLengthSeconds) {
        if (activityLengthSeconds <= 0) return 0.0;

        double minutes = Math.max(activityLengthSeconds / 60.0, 1.0);

        double pausePenalty = Math.min(1.0, (pauseCount / minutes) / PAUSES_PER_MIN_SATURATION);
        double switchPenalty = Math.min(1.0, (tabSwitchCount / minutes) / SWITCHES_PER_MIN_SATURATION);

        double avgResponseTime = answerTimes == null ? 0.0
                : Arrays.stream(answerTimes)
                        .filter(Objects::nonNull)
                        .mapToInt(Integer::intValue)
                        .average().orElse(0.0);
        double responsePenalty = avgResponseTime <= 0 ? 0.0
                : Math.min(1.0, avgResponseTime / RESPONSE_SECONDS_SATURATION);

        double score = 1.0
                - (PAUSE_WEIGHT * pausePenalty)
                - (SWITCH_WEIGHT * switchPenalty)
                - (RESPONSE_WEIGHT * responsePenalty);

        return Math.max(Math.min(score * 100.0, 100.0), 0.0);
    }
}
