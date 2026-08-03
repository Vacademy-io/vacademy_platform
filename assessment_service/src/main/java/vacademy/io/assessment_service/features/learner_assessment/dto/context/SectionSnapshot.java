package vacademy.io.assessment_service.features.learner_assessment.dto.context;

/**
 * Small, entity-free stand-in for {@code Section}. Holds exactly the getters
 * {@code buildSectionComparisonFromContext} reads — nothing else, so no
 * lazy-collection or detached-entity risk. See ARCHITECTURE.md §5.2 / X4.
 */
public record SectionSnapshot(String id, String name, Double totalMarks,
                               Double cutOffMarks, Integer sectionOrder) {
}
