package vacademy.io.assessment_service.features.learner_assessment.dto.context;

/**
 * Typed, normalised stand-in for the raw {@code Object[]} rows returned by
 * {@code findSectionWiseAggregation} (native query). Element types are
 * driver-dependent (BigDecimal vs Double vs Long); normalising once at load
 * time via {@link #from(Object[])} avoids a ClassCastException on the
 * class-cast pattern at LearnerReportService's section-comparison arithmetic
 * after a JSON round-trip. See ASSESSMENT_BULK_REPORT_EXPORT_ARCHITECTURE.md §5.2 / X2.
 */
public record SectionAggregateSnapshot(String sectionId, Double avgMarks, Double maxMarks,
                                        Long totalCorrect, Long totalQuestions) {

    public static SectionAggregateSnapshot from(Object[] row) {
        return new SectionAggregateSnapshot(
                (String) row[0],
                num(row, 1) == null ? 0.0 : num(row, 1).doubleValue(),
                num(row, 2) == null ? 0.0 : num(row, 2).doubleValue(),
                num(row, 3) == null ? null : num(row, 3).longValue(),
                num(row, 4) == null ? null : num(row, 4).longValue());
    }

    private static Number num(Object[] r, int i) {
        return (r.length > i && r[i] instanceof Number n) ? n : null;
    }
}
