package vacademy.io.admin_core_service.features.translation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.translation.dto.TranslationReviewItemProjection;
import vacademy.io.admin_core_service.features.translation.dto.TranslationStateCountProjection;
import vacademy.io.admin_core_service.features.translation.entity.RichTextTranslation;

import java.util.List;
import java.util.Optional;

public interface RichTextTranslationRepository extends JpaRepository<RichTextTranslation, String> {

    Optional<RichTextTranslation> findByRichTextIdAndLocale(String richTextId, String locale);

    /**
     * Counts rich-text translation rows by state for one (packageSession, locale),
     * resolving which rich_text_data ids belong to the package session by walking
     * the content graph the learner delivery queries serve: slides of the package
     * session -> per-source-type question/option/description rich text columns.
     * READ-ONLY status/reporting query.
     */
    @Query(value = """
            WITH ps_slides AS (
                SELECT s.id, s.source_id, s.source_type
                FROM chapter_package_session_mapping cpsm
                JOIN chapter_to_slides cts ON cts.chapter_id = cpsm.chapter_id AND cts.status <> 'DELETED'
                JOIN slide s ON s.id = cts.slide_id AND s.status <> 'DELETED'
                WHERE cpsm.package_session_id = :packageSessionId
                  AND cpsm.status <> 'DELETED'
            ),
            ps_rich_texts AS (
                SELECT DISTINCT rid FROM (
                    -- VIDEO slide questions + options
                    SELECT unnest(ARRAY[q.text_id, q.parent_rich_text_id, q.explanation_text_id]) AS rid
                    FROM ps_slides sl
                    JOIN video_slide_question q ON sl.source_type = 'VIDEO' AND q.video_slide_id = sl.source_id
                    UNION ALL
                    SELECT unnest(ARRAY[o.text_id, o.explanation_text_id])
                    FROM ps_slides sl
                    JOIN video_slide_question q ON sl.source_type = 'VIDEO' AND q.video_slide_id = sl.source_id
                    JOIN video_slide_question_options o ON o.video_slide_question_id = q.id
                    UNION ALL
                    -- QUESTION slides + options
                    SELECT unnest(ARRAY[q.text_id, q.parent_rich_text_id, q.explanation_text_id])
                    FROM ps_slides sl
                    JOIN question_slide q ON sl.source_type = 'QUESTION' AND q.id = sl.source_id
                    UNION ALL
                    SELECT unnest(ARRAY[o.text_id, o.explanation_text_id])
                    FROM ps_slides sl
                    JOIN question_slide q ON sl.source_type = 'QUESTION' AND q.id = sl.source_id
                    JOIN option o ON o.question_id = q.id
                    UNION ALL
                    -- ASSIGNMENT slides + questions
                    SELECT unnest(ARRAY[a.text_id, a.parent_rich_text_id])
                    FROM ps_slides sl
                    JOIN assignment_slide a ON sl.source_type = 'ASSIGNMENT' AND a.id = sl.source_id
                    UNION ALL
                    SELECT q.text_id
                    FROM ps_slides sl
                    JOIN assignment_slide a ON sl.source_type = 'ASSIGNMENT' AND a.id = sl.source_id
                    JOIN assignment_slide_question q ON q.assignment_slide_id = a.id
                    UNION ALL
                    -- QUIZ slides (description is a rich_text_data id) + questions + options
                    SELECT qs.description
                    FROM ps_slides sl
                    JOIN quiz_slide qs ON sl.source_type = 'QUIZ' AND qs.id = sl.source_id
                    UNION ALL
                    SELECT unnest(ARRAY[q.text_id, q.parent_rich_text_id, q.explanation_text_id])
                    FROM ps_slides sl
                    JOIN quiz_slide qs ON sl.source_type = 'QUIZ' AND qs.id = sl.source_id
                    JOIN quiz_slide_question q ON q.quiz_slide_id = qs.id
                    UNION ALL
                    SELECT unnest(ARRAY[o.text_id, o.explanation_text_id])
                    FROM ps_slides sl
                    JOIN quiz_slide qs ON sl.source_type = 'QUIZ' AND qs.id = sl.source_id
                    JOIN quiz_slide_question q ON q.quiz_slide_id = qs.id
                    JOIN quiz_slide_question_options o ON o.quiz_slide_question_id = q.id
                ) refs
                WHERE rid IS NOT NULL
            )
            SELECT rtt.state AS state, COUNT(*) AS cnt
            FROM rich_text_translation rtt
            JOIN ps_rich_texts prt ON prt.rid = rtt.rich_text_id
            WHERE rtt.locale = :locale
            GROUP BY rtt.state
            """, nativeQuery = true)
    List<TranslationStateCountProjection> countByStateForPackageSession(
            @Param("packageSessionId") String packageSessionId,
            @Param("locale") String locale);

    /**
     * Review-items page for one (packageSession, locale): UNION of the two text
     * sidecar tables scoped to the package session with the same content-graph
     * walk as {@link #countByStateForPackageSession}. base content is joined
     * where cheap: rich_text_data for RICH_TEXT rows, slide title/description
     * for SLIDE ENTITY_FIELD rows (else NULL). Pass state = '' for no state
     * filter. READ-ONLY review/listing query.
     */
    @Query(value = """
            WITH ps_slides AS (
                SELECT s.id, s.source_id, s.source_type, s.title, s.description
                FROM chapter_package_session_mapping cpsm
                JOIN chapter_to_slides cts ON cts.chapter_id = cpsm.chapter_id AND cts.status <> 'DELETED'
                JOIN slide s ON s.id = cts.slide_id AND s.status <> 'DELETED'
                WHERE cpsm.package_session_id = :packageSessionId
                  AND cpsm.status <> 'DELETED'
            ),
            ps_rich_texts AS (
                SELECT DISTINCT rid FROM (
                    -- VIDEO slide questions + options
                    SELECT unnest(ARRAY[q.text_id, q.parent_rich_text_id, q.explanation_text_id]) AS rid
                    FROM ps_slides sl
                    JOIN video_slide_question q ON sl.source_type = 'VIDEO' AND q.video_slide_id = sl.source_id
                    UNION ALL
                    SELECT unnest(ARRAY[o.text_id, o.explanation_text_id])
                    FROM ps_slides sl
                    JOIN video_slide_question q ON sl.source_type = 'VIDEO' AND q.video_slide_id = sl.source_id
                    JOIN video_slide_question_options o ON o.video_slide_question_id = q.id
                    UNION ALL
                    -- QUESTION slides + options
                    SELECT unnest(ARRAY[q.text_id, q.parent_rich_text_id, q.explanation_text_id])
                    FROM ps_slides sl
                    JOIN question_slide q ON sl.source_type = 'QUESTION' AND q.id = sl.source_id
                    UNION ALL
                    SELECT unnest(ARRAY[o.text_id, o.explanation_text_id])
                    FROM ps_slides sl
                    JOIN question_slide q ON sl.source_type = 'QUESTION' AND q.id = sl.source_id
                    JOIN option o ON o.question_id = q.id
                    UNION ALL
                    -- ASSIGNMENT slides + questions
                    SELECT unnest(ARRAY[a.text_id, a.parent_rich_text_id])
                    FROM ps_slides sl
                    JOIN assignment_slide a ON sl.source_type = 'ASSIGNMENT' AND a.id = sl.source_id
                    UNION ALL
                    SELECT q.text_id
                    FROM ps_slides sl
                    JOIN assignment_slide a ON sl.source_type = 'ASSIGNMENT' AND a.id = sl.source_id
                    JOIN assignment_slide_question q ON q.assignment_slide_id = a.id
                    UNION ALL
                    -- QUIZ slides (description is a rich_text_data id) + questions + options
                    SELECT qs.description
                    FROM ps_slides sl
                    JOIN quiz_slide qs ON sl.source_type = 'QUIZ' AND qs.id = sl.source_id
                    UNION ALL
                    SELECT unnest(ARRAY[q.text_id, q.parent_rich_text_id, q.explanation_text_id])
                    FROM ps_slides sl
                    JOIN quiz_slide qs ON sl.source_type = 'QUIZ' AND qs.id = sl.source_id
                    JOIN quiz_slide_question q ON q.quiz_slide_id = qs.id
                    UNION ALL
                    SELECT unnest(ARRAY[o.text_id, o.explanation_text_id])
                    FROM ps_slides sl
                    JOIN quiz_slide qs ON sl.source_type = 'QUIZ' AND qs.id = sl.source_id
                    JOIN quiz_slide_question q ON q.quiz_slide_id = qs.id
                    JOIN quiz_slide_question_options o ON o.quiz_slide_question_id = q.id
                ) refs
                WHERE rid IS NOT NULL
            )
            SELECT * FROM (
                SELECT 'RICH_TEXT' AS itemTable,
                       rtt.id AS id,
                       rtt.state AS state,
                       rtt.content AS translatedContent,
                       rtd.content AS baseContent,
                       NULL AS entityType,
                       NULL AS entityId,
                       NULL AS field,
                       rtt.rich_text_id AS richTextId,
                       rtt.translated_by AS translatedBy,
                       rtt.updated_at AS updatedAt
                FROM rich_text_translation rtt
                JOIN ps_rich_texts prt ON prt.rid = rtt.rich_text_id
                LEFT JOIN rich_text_data rtd ON rtd.id = rtt.rich_text_id
                WHERE rtt.locale = :locale
                  AND (:state = '' OR rtt.state = :state)
                UNION ALL
                SELECT 'ENTITY_FIELD',
                       eft.id,
                       eft.state,
                       eft.content,
                       CASE
                           WHEN eft.field = 'title' THEN sl.title
                           WHEN eft.field = 'description' THEN sl.description
                           ELSE NULL
                       END,
                       eft.entity_type,
                       eft.entity_id,
                       eft.field,
                       NULL,
                       eft.translated_by,
                       eft.updated_at
                FROM entity_field_translation eft
                JOIN ps_slides sl ON eft.entity_type = 'SLIDE' AND sl.id = eft.entity_id
                WHERE eft.locale = :locale
                  AND (:state = '' OR eft.state = :state)
            ) review_items
            ORDER BY updatedAt DESC, id
            LIMIT :size OFFSET :offset
            """, nativeQuery = true)
    List<TranslationReviewItemProjection> findReviewItemsForPackageSession(
            @Param("packageSessionId") String packageSessionId,
            @Param("locale") String locale,
            @Param("state") String state,
            @Param("size") int size,
            @Param("offset") long offset);

    /**
     * Total count matching {@link #findReviewItemsForPackageSession} (same
     * scoping, same state filter semantics — pass state = '' for all states).
     */
    @Query(value = """
            WITH ps_slides AS (
                SELECT s.id, s.source_id, s.source_type
                FROM chapter_package_session_mapping cpsm
                JOIN chapter_to_slides cts ON cts.chapter_id = cpsm.chapter_id AND cts.status <> 'DELETED'
                JOIN slide s ON s.id = cts.slide_id AND s.status <> 'DELETED'
                WHERE cpsm.package_session_id = :packageSessionId
                  AND cpsm.status <> 'DELETED'
            ),
            ps_rich_texts AS (
                SELECT DISTINCT rid FROM (
                    SELECT unnest(ARRAY[q.text_id, q.parent_rich_text_id, q.explanation_text_id]) AS rid
                    FROM ps_slides sl
                    JOIN video_slide_question q ON sl.source_type = 'VIDEO' AND q.video_slide_id = sl.source_id
                    UNION ALL
                    SELECT unnest(ARRAY[o.text_id, o.explanation_text_id])
                    FROM ps_slides sl
                    JOIN video_slide_question q ON sl.source_type = 'VIDEO' AND q.video_slide_id = sl.source_id
                    JOIN video_slide_question_options o ON o.video_slide_question_id = q.id
                    UNION ALL
                    SELECT unnest(ARRAY[q.text_id, q.parent_rich_text_id, q.explanation_text_id])
                    FROM ps_slides sl
                    JOIN question_slide q ON sl.source_type = 'QUESTION' AND q.id = sl.source_id
                    UNION ALL
                    SELECT unnest(ARRAY[o.text_id, o.explanation_text_id])
                    FROM ps_slides sl
                    JOIN question_slide q ON sl.source_type = 'QUESTION' AND q.id = sl.source_id
                    JOIN option o ON o.question_id = q.id
                    UNION ALL
                    SELECT unnest(ARRAY[a.text_id, a.parent_rich_text_id])
                    FROM ps_slides sl
                    JOIN assignment_slide a ON sl.source_type = 'ASSIGNMENT' AND a.id = sl.source_id
                    UNION ALL
                    SELECT q.text_id
                    FROM ps_slides sl
                    JOIN assignment_slide a ON sl.source_type = 'ASSIGNMENT' AND a.id = sl.source_id
                    JOIN assignment_slide_question q ON q.assignment_slide_id = a.id
                    UNION ALL
                    SELECT qs.description
                    FROM ps_slides sl
                    JOIN quiz_slide qs ON sl.source_type = 'QUIZ' AND qs.id = sl.source_id
                    UNION ALL
                    SELECT unnest(ARRAY[q.text_id, q.parent_rich_text_id, q.explanation_text_id])
                    FROM ps_slides sl
                    JOIN quiz_slide qs ON sl.source_type = 'QUIZ' AND qs.id = sl.source_id
                    JOIN quiz_slide_question q ON q.quiz_slide_id = qs.id
                    UNION ALL
                    SELECT unnest(ARRAY[o.text_id, o.explanation_text_id])
                    FROM ps_slides sl
                    JOIN quiz_slide qs ON sl.source_type = 'QUIZ' AND qs.id = sl.source_id
                    JOIN quiz_slide_question q ON q.quiz_slide_id = qs.id
                    JOIN quiz_slide_question_options o ON o.quiz_slide_question_id = q.id
                ) refs
                WHERE rid IS NOT NULL
            )
            SELECT (
                SELECT COUNT(*)
                FROM rich_text_translation rtt
                JOIN ps_rich_texts prt ON prt.rid = rtt.rich_text_id
                WHERE rtt.locale = :locale
                  AND (:state = '' OR rtt.state = :state)
            ) + (
                SELECT COUNT(*)
                FROM entity_field_translation eft
                JOIN ps_slides sl ON eft.entity_type = 'SLIDE' AND sl.id = eft.entity_id
                WHERE eft.locale = :locale
                  AND (:state = '' OR eft.state = :state)
            )
            """, nativeQuery = true)
    long countReviewItemsForPackageSession(
            @Param("packageSessionId") String packageSessionId,
            @Param("locale") String locale,
            @Param("state") String state);
}
