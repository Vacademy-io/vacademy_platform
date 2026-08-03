package vacademy.io.assessment_service.features.learner_assessment.dto.context;

/**
 * Class-invariant part of the marks-distribution histogram (HtmlBuilderService
 * marks-distribution block). Deliberately excludes the per-student bucket
 * index — that must be computed by the caller from the individual student's
 * marks, not hoisted here.
 */
public record HistogramSpec(int bucketSize, int numBuckets, int[] bucketCounts,
                             int maxCount, int avgBucketIdx) {
}
