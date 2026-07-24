package vacademy.io.assessment_service.features.translation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.assessment_service.features.translation.entity.RichTextTranslation;

import java.util.List;
import java.util.Optional;

public interface RichTextTranslationRepository extends JpaRepository<RichTextTranslation, String> {

    /**
     * All rich-text ids an assessment references (question text, comprehension
     * passages, explanations, option text + explanations, section
     * descriptions). Deleted sections are excluded. Used to compute
     * translation coverage; compile-time constant so it can be embedded in
     * the {@code @Query} annotations below.
     */
    String ASSESSMENT_RICH_TEXT_IDS = """
            SELECT s.description_id AS rid FROM "section" s
              WHERE s.assessment_id = :assessmentId AND s.description_id IS NOT NULL
                AND (s.status IS NULL OR s.status <> 'DELETED')
            UNION
            SELECT q.text_id FROM question_assessment_section_mapping m
              JOIN "section" s ON s.id = m.section_id
              JOIN question q ON q.id = m.question_id
              WHERE s.assessment_id = :assessmentId AND q.text_id IS NOT NULL
                AND (s.status IS NULL OR s.status <> 'DELETED')
            UNION
            SELECT q.parent_rich_text_id FROM question_assessment_section_mapping m
              JOIN "section" s ON s.id = m.section_id
              JOIN question q ON q.id = m.question_id
              WHERE s.assessment_id = :assessmentId AND q.parent_rich_text_id IS NOT NULL
                AND (s.status IS NULL OR s.status <> 'DELETED')
            UNION
            SELECT q.explanation_text_id FROM question_assessment_section_mapping m
              JOIN "section" s ON s.id = m.section_id
              JOIN question q ON q.id = m.question_id
              WHERE s.assessment_id = :assessmentId AND q.explanation_text_id IS NOT NULL
                AND (s.status IS NULL OR s.status <> 'DELETED')
            UNION
            SELECT o.text_id FROM "option" o
              JOIN question_assessment_section_mapping m ON m.question_id = o.question_id
              JOIN "section" s ON s.id = m.section_id
              WHERE s.assessment_id = :assessmentId AND o.text_id IS NOT NULL
                AND (s.status IS NULL OR s.status <> 'DELETED')
            UNION
            SELECT o.explanation_text_id FROM "option" o
              JOIN question_assessment_section_mapping m ON m.question_id = o.question_id
              JOIN "section" s ON s.id = m.section_id
              WHERE s.assessment_id = :assessmentId AND o.explanation_text_id IS NOT NULL
                AND (s.status IS NULL OR s.status <> 'DELETED')
            """;

    /** One-shot fetch for learner delivery: servable rows for a set of rich-text ids. */
    List<RichTextTranslation> findByRichTextIdInAndLocaleAndStateIn(List<String> richTextIds, String locale,
            List<String> states);

    /** Upsert lookup (unique key: rich_text_id + locale). */
    Optional<RichTextTranslation> findByRichTextIdAndLocale(String richTextId, String locale);

    /** How many of the assessment's strings have a PUBLISHED translation in the locale. */
    @Query(value = "SELECT count(*) FROM rich_text_translation t " +
            "WHERE t.locale = :locale AND t.state = 'PUBLISHED' AND t.rich_text_id IN (" +
            ASSESSMENT_RICH_TEXT_IDS + ")", nativeQuery = true)
    long countPublishedForAssessment(@Param("assessmentId") String assessmentId, @Param("locale") String locale);

    /** Total number of translatable rich-text strings the assessment references. */
    @Query(value = "SELECT count(*) FROM (" + ASSESSMENT_RICH_TEXT_IDS + ") x", nativeQuery = true)
    long countTranslatableForAssessment(@Param("assessmentId") String assessmentId);
}
