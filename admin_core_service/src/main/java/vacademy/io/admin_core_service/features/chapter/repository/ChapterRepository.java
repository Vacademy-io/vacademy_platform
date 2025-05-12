package vacademy.io.admin_core_service.features.chapter.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;

import java.util.List;

@Repository
public interface ChapterRepository extends JpaRepository<Chapter, String> {

    @Query(
            value = """
    SELECT json_agg(
        json_build_object(
            'chapter', json_build_object(
                'id', c.id,
                'chapter_name', c.chapter_name,
                'status', c.status,
                'file_id', c.file_id,
                'description', c.description,
                'chapter_order', cps.chapter_order
            ),
            'slides', (
                SELECT json_agg(slide_data ORDER BY slide_order IS NOT NULL, slide_order, created_at DESC)
                FROM (
                    -- VIDEO SLIDES
                    SELECT 
                        s.created_at,
                        cs.slide_order,
                        json_build_object(
                            'id', s.id,
                            'title', s.title,
                            'status', s.status,
                            'is_loaded', true,
                            'new_slide', true,
                            'source_id', s.source_id,
                            'description', s.description,
                            'slide_order', cs.slide_order,
                            'source_type', s.source_type,
                            'video_slide', json_build_object(
                                'id', v.id,
                                'url', v.url,
                                'title', v.title,
                                'description', v.description,
                                'source_type', v.source_type,
                                'published_url', v.published_url,
                                'video_length_in_millis', v.video_length,
                                'published_video_length_in_millis', v.published_video_length,
                                'questions', COALESCE((
                                    SELECT json_agg(
                                        json_build_object(
                                            'id', q.id,
                                            'question_response_type', q.question_response_type,
                                            'question_type', q.question_type,
                                            'access_level', q.access_level,
                                            'question_order', q.question_order,
                                            'question_time_in_millis', q.question_time_in_millis,
                                            'media_id', q.media_id,
                                            'auto_evaluation_json', q.auto_evaluation_json,
                                            'evaluation_type', q.evaluation_type,
                                            'text_data', json_build_object('id', rt_text.id, 'type', 'RICH_TEXT', 'content', rt_text.content),
                                            'parent_rich_text', CASE WHEN q.parent_rich_text_id IS NOT NULL THEN json_build_object('id', rt_parent.id, 'type', 'RICH_TEXT', 'content', rt_parent.content) ELSE NULL END,
                                            'explanation_text_data', CASE WHEN q.explanation_text_id IS NOT NULL THEN json_build_object('id', rt_exp.id, 'type', 'RICH_TEXT', 'content', rt_exp.content) ELSE NULL END,
                                            'options', COALESCE((
                                                SELECT json_agg(
                                                    json_build_object(
                                                        'id', o.id,
                                                        'media_id', o.media_id,
                                                        'text', CASE WHEN o.text_id IS NOT NULL THEN json_build_object('id', rt_opt.id, 'type', 'RICH_TEXT', 'content', rt_opt.content) ELSE NULL END,
                                                        'explanation_text_data', CASE WHEN o.explanation_text_id IS NOT NULL THEN json_build_object('id', rt_opt_exp.id, 'type', 'RICH_TEXT', 'content', rt_opt_exp.content) ELSE NULL END
                                                    )
                                                )
                                                FROM video_slide_question_options o
                                                LEFT JOIN rich_text_data rt_opt ON rt_opt.id = o.text_id
                                                LEFT JOIN rich_text_data rt_opt_exp ON rt_opt_exp.id = o.explanation_text_id
                                                WHERE o.video_slide_question_id = q.id
                                            ), CAST('[]' AS json))
                                        )
                                        ORDER BY q.question_order
                                    )
                                    FROM video_slide_question q
                                    LEFT JOIN rich_text_data rt_text ON rt_text.id = q.text_id
                                    LEFT JOIN rich_text_data rt_parent ON rt_parent.id = q.parent_rich_text_id
                                    LEFT JOIN rich_text_data rt_exp ON rt_exp.id = q.explanation_text_id
                                    WHERE q.video_slide_id = v.id
                                    AND q.status IN (:videoSlideQuestionStatus)
                                ), CAST('[]' AS json))
                            )
                        ) AS slide_data
                    FROM slide s
                    JOIN chapter_to_slides cs ON cs.slide_id = s.id
                    JOIN video v ON v.id = s.source_id
                    WHERE s.source_type = 'VIDEO'
                    AND s.status IN (:slideStatus)
                    AND cs.status IN (:chapterToSlidesStatus)
                    AND cs.chapter_id = c.id

                    UNION ALL

                    -- DOCUMENT SLIDES
                    SELECT 
                        s.created_at,
                        cs.slide_order,
                        json_build_object(
                            'id', s.id,
                            'title', s.title,
                            'status', s.status,
                            'is_loaded', true,
                            'new_slide', true,
                            'source_id', s.source_id,
                            'description', s.description,
                            'slide_order', cs.slide_order,
                            'source_type', s.source_type,
                            'document_slide', json_build_object(
                                'id', d.id,
                                'title', d.title,
                                'type', d.type,
                                'cover_file_id', d.cover_file_id,
                                'total_pages', d.total_pages,
                                'published_document_total_pages', d.published_document_total_pages,
                                'data', d.data,
                                'published_data', d.published_data
                            )
                        ) AS slide_data
                    FROM slide s
                    JOIN chapter_to_slides cs ON cs.slide_id = s.id
                    JOIN document_slide d ON d.id = s.source_id
                    WHERE s.source_type = 'DOCUMENT'
                    AND s.status IN (:slideStatus)
                    AND cs.status IN (:chapterToSlidesStatus)
                    AND cs.chapter_id = c.id

                    UNION ALL

                    -- QUESTION SLIDES
                    SELECT 
                        s.created_at,
                        cs.slide_order,
                        json_build_object(
                            'id', s.id,
                            'title', s.title,
                            'status', s.status,
                            'source_id', s.source_id,
                            'description', s.description,
                            'slide_order', cs.slide_order,
                            'source_type', s.source_type,
                            'question_slide', json_build_object(
                                'id', q.id,
                                'question_type', q.question_type,
                                'question_response_type', q.question_response_type,
                                'access_level', q.access_level,
                                'default_question_time_mins', q.default_question_time_mins,
                                'points', q.points,
                                're_attempt_count', q.re_attempt_count,
                                'auto_evaluation_json', q.auto_evaluation_json,
                                'evaluation_type', q.evaluation_type,
                                'media_id', q.media_id,
                                'source_type', q.source_type,
                                'text_data', json_build_object('id', rt_text.id, 'type', 'RICH_TEXT', 'content', rt_text.content),
                                'parent_rich_text', CASE WHEN q.parent_rich_text_id IS NOT NULL THEN json_build_object('id', rt_parent.id, 'type', 'RICH_TEXT', 'content', rt_parent.content) ELSE NULL END,
                                'explanation_text_data', CASE WHEN q.explanation_text_id IS NOT NULL THEN json_build_object('id', rt_exp.id, 'type', 'RICH_TEXT', 'content', rt_exp.content) ELSE NULL END,
                                'options', COALESCE((
                                    SELECT json_agg(
                                        json_build_object(
                                            'id', o.id,
                                            'media_id', o.media_id,
                                            'text', CASE WHEN o.text_id IS NOT NULL THEN json_build_object('id', rt_opt.id, 'type', 'RICH_TEXT', 'content', rt_opt.content) ELSE NULL END,
                                            'explanation_text_data', CASE WHEN o.explanation_text_id IS NOT NULL THEN json_build_object('id', rt_opt_exp.id, 'type', 'RICH_TEXT', 'content', rt_opt_exp.content) ELSE NULL END
                                        )
                                        ORDER BY o.created_on
                                    )
                                    FROM option o
                                    LEFT JOIN rich_text_data rt_opt ON rt_opt.id = o.text_id
                                    LEFT JOIN rich_text_data rt_opt_exp ON rt_opt_exp.id = o.explanation_text_id
                                    WHERE o.question_id = q.id
                                ), CAST('[]' AS json))
                            )
                        ) AS slide_data
                    FROM slide s
                    JOIN chapter_to_slides cs ON cs.slide_id = s.id
                    JOIN question_slide q ON q.id = s.source_id
                    LEFT JOIN rich_text_data rt_text ON rt_text.id = q.text_id
                    LEFT JOIN rich_text_data rt_parent ON rt_parent.id = q.parent_rich_text_id
                    LEFT JOIN rich_text_data rt_exp ON rt_exp.id = q.explanation_text_id
                    WHERE s.source_type = 'QUESTION'
                    AND s.status IN (:slideStatus)
                    AND cs.status IN (:chapterToSlidesStatus)
                    AND cs.chapter_id = c.id

                    UNION ALL

                    -- ASSIGNMENT SLIDES
                    SELECT 
                        s.created_at,
                        cs.slide_order,
                        json_build_object(
                            'id', s.id,
                            'title', s.title,
                            'status', s.status,
                            'is_loaded', true,
                            'new_slide', true,
                            'source_id', s.source_id,
                            'description', s.description,
                            'slide_order', cs.slide_order,
                            'source_type', s.source_type,
                            'assignment_slide', json_build_object(
                                'id', a.id,
                                'live_date', a.live_date,
                                'end_date', a.end_date,
                                'comma_separated_media_ids', a.comma_separated_media_ids,
                                're_attempt_count', a.re_attempt_count,
                                'text_data', CASE WHEN a.text_id IS NOT NULL THEN json_build_object('id', rt_text.id, 'type', 'RICH_TEXT', 'content', rt_text.content) ELSE NULL END,
                                'parent_rich_text', CASE WHEN a.parent_rich_text_id IS NOT NULL THEN json_build_object('id', rt_parent.id, 'type', 'RICH_TEXT', 'content', rt_parent.content) ELSE NULL END
                            )
                        ) AS slide_data
                    FROM slide s
                    JOIN chapter_to_slides cs ON cs.slide_id = s.id
                    JOIN assignment_slide a ON a.id = s.source_id
                    LEFT JOIN rich_text_data rt_text ON rt_text.id = a.text_id
                    LEFT JOIN rich_text_data rt_parent ON rt_parent.id = a.parent_rich_text_id
                    WHERE s.source_type = 'ASSIGNMENT'
                    AND s.status IN (:slideStatus)
                    AND cs.status IN (:chapterToSlidesStatus)
                    AND cs.chapter_id = c.id
                ) slide_data
            )
        )
    )
    FROM chapter c
    JOIN module_chapter_mapping mc ON mc.chapter_id = c.id
    JOIN chapter_package_session_mapping cps ON cps.chapter_id = c.id
    WHERE mc.module_id = :moduleId
    AND cps.package_session_id = :packageSessionId
    AND c.status IN (:chapterStatus)
    AND cps.status IN (:chapterToPackageSessionStatus)
    """,
            nativeQuery = true
    )
    String getChaptersAndSlidesByModuleIdAndPackageSessionId(
            @Param("moduleId") String moduleId,
            @Param("chapterStatus") List<String> chapterStatus,
            @Param("packageSessionId") String packageSessionId,
            @Param("chapterToPackageSessionStatus") List<String> chapterToPackageSessionStatus,
            @Param("slideStatus") List<String> slideStatus,
            @Param("chapterToSlidesStatus") List<String> chapterToSlidesStatus,
            @Param("videoSlideQuestionStatus") List<String> videoSlideQuestionStatus
    );

}
