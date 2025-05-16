package vacademy.io.admin_core_service.features.learner_tracking.util;

import java.util.Arrays;

public class ConcentrationScoreCalculator {

    public static double calculateConcentrationScore(int pauseCount, int tabSwitchCount, Integer[] answerTimes, int activityLength) {
        if (activityLength <= 0) return 0.0;

        // Define weights for each metric
        double pauseWeight = 0.5;
        double switchWeight = 0.3;
        double responseWeight = 0.2;

        // Normalize pause count and tab switch count by activity length
        double normalizedPause = (double) pauseCount / activityLength;
        double normalizedSwitch = (double) tabSwitchCount / activityLength;

        // Calculate average response time
        double avgResponseTime = answerTimes.length > 0 ?
                Arrays.stream(answerTimes).mapToInt(Integer::intValue).average().orElse(0.0) : 0.0;

        // Calculate response score: higher response time means lower concentration
        double responseScore = 1.0 / (1.0 + avgResponseTime);

        // Introduce a normalization factor based on activity length
        // Activity length normalization: Scale the score so that higher activity length increases the concentration score
        double activityLengthFactor = Math.log(activityLength + 1); // log scale to prevent extreme values for very large activity lengths

        // Calculate the concentration score
        double score = 1.0 - ((pauseWeight * normalizedPause) + (switchWeight * normalizedSwitch) + (responseWeight * (1 - responseScore)));

        // Apply activity length factor to adjust the score based on activity duration
        score *= activityLengthFactor;

        // Return a normalized score between 0 and 100
        return Math.max(Math.min(score * 100, 100.0), 0.0); // Ensure score is between 0 and 100
    }
}
