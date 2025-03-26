package vacademy.io.admin_core_service.features.learner_tracking.util;

import java.util.Arrays;

public class ConcentrationScoreCalculator {

    public static double calculateConcentrationScore(int pauseCount, int tabSwitchCount, Integer[] answerTimes, int activityLength) {
        if (activityLength <= 0) return 0.0;

        double pauseWeight = 0.5;
        double switchWeight = 0.3;
        double responseWeight = 0.2;

        double normalizedPause = (double) pauseCount / activityLength;
        double normalizedSwitch = (double) tabSwitchCount / activityLength;
        double avgResponseTime = answerTimes.length > 0 ?
                Arrays.stream(answerTimes).mapToInt(Integer::intValue).average().orElse(0.0) : 0.0;

        double responseScore = 1.0 / (1.0 + avgResponseTime);

        double score = 1.0 - ((pauseWeight * normalizedPause) + (switchWeight * normalizedSwitch) + (responseWeight * (1 - responseScore)));

        return Math.max(score * 100, 0.0); // Convert to a 0-100 scale
    }

}
