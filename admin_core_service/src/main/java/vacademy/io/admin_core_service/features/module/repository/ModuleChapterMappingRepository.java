package vacademy.io.admin_core_service.features.module.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDetailsProjection;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;
import vacademy.io.admin_core_service.features.module.entity.ModuleChapterMapping;

import java.util.List;

public interface ModuleChapterMappingRepository extends JpaRepository<ModuleChapterMapping, String> {
    @Query("SELECT mcm.chapter FROM ModuleChapterMapping mcm " +
            "WHERE mcm.module.id = :moduleId " +
            "AND mcm.chapter.status != 'DELETED' " +
            "AND NOT EXISTS (SELECT 1 FROM ChapterPackageSessionMapping cpsm " +
            "                WHERE cpsm.chapter.id = mcm.chapter.id " +
            "                AND cpsm.status = 'DELETED' " +
            "                AND cpsm.packageSession.id = :packageSessionId)")
    List<Chapter> findChaptersByModuleIdAndStatusNotDeleted(String moduleId, String packageSessionId);

    @Query(value = """
            SELECT json_agg(module_data) AS module_array
            FROM (
                SELECT json_build_object(
                    'module', json_build_object(
                        'id', m.id,
                        'module_name', m.module_name,
                        'description', m.description,
                        'thumbnail_id', m.thumbnail_id
                    ),
                    'percentage_completed', COALESCE(CAST(
                        MAX(CASE
                            WHEN mo.value ~ '^[0-9]+(\\.[0-9]+)?$' THEN mo.value
                            ELSE '0'
                        END) AS FLOAT
                    ), 0.0),
                    'chapters', COALESCE(json_agg(
                        jsonb_build_object(
                            'id', c.id,
                            'chapter_name', c.chapter_name,
                            'status', c.status,
                            'file_id', c.file_id,
                            'description', c.description,
                            'drip_condition', c.drip_condition_json,
                            'percentage_completed', chap_data.percentage_completed,
                            'last_slide_viewed', chap_data.last_slide_viewed,
                            'video_count', chap_data.video_count,
                            'pdf_count', chap_data.pdf_count,
                            'doc_count', chap_data.doc_count,
                            'question_slide_count', chap_data.question_slide_count,
                            'assignment_slide_count', chap_data.assignment_slide_count,
                            'survey_slide_count', chap_data.survey_slide_count,
                            'unknown_count', chap_data.unknown_count
                        ) ORDER BY cpsm.chapter_order ASC NULLS LAST
                    ) FILTER (WHERE c.id IS NOT NULL), CAST('[]' AS json))
                ) AS module_data
                FROM subject_module_mapping smm
                JOIN modules m ON smm.module_id = m.id AND m.status IN (:moduleStatusList)
                LEFT JOIN learner_operation mo
                    ON mo.source_id = m.id
                    AND mo.source = 'MODULE'
                    AND mo.operation = :moduleOperation
                    AND mo.user_id = :userId
                LEFT JOIN module_chapter_mapping mcm ON mcm.module_id = m.id
                LEFT JOIN chapter c ON c.id = mcm.chapter_id AND c.status IN (:chapterStatusList)
                JOIN chapter_package_session_mapping cpsm
                    ON cpsm.chapter_id = c.id
                    AND cpsm.package_session_id = :packageSessionId
                    AND cpsm.status IN (:chapterStatusList)
                LEFT JOIN (
                    SELECT
                        c.id AS chapter_id,
                        MAX(CASE
                            WHEN lo.operation = :chapterOperation AND lo.value ~ '^[0-9]+(\\.[0-9]+)?$'
                            THEN CAST(lo.value AS FLOAT)
                            ELSE 0.0
                        END) AS percentage_completed,
                        MAX(CASE WHEN lo.operation = 'LAST_SLIDE_VIEWED' THEN lo.value END) AS last_slide_viewed,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'VIDEO' THEN s.id END) AS video_count,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'DOCUMENT' AND d.type = 'PDF' THEN s.id END) AS pdf_count,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'DOCUMENT' AND d.type = 'DOC' THEN s.id END) AS doc_count,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'QUESTION' THEN s.id END) AS question_slide_count,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'ASSIGNMENT' THEN s.id END) AS assignment_slide_count,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'SURVEY' THEN s.id END) AS survey_slide_count,
                        COUNT(DISTINCT CASE
                            WHEN s.source_type NOT IN ('VIDEO', 'DOCUMENT', 'QUESTION', 'ASSIGNMENT', 'SURVEY')
                                 OR s.source_type IS NULL THEN s.id
                        END) AS unknown_count
                    FROM chapter c
                    LEFT JOIN chapter_to_slides cs ON cs.chapter_id = c.id AND cs.status IN (:chapterToSlideStatusList)
                    LEFT JOIN slide s ON cs.slide_id = s.id AND s.status IN (:slideStatusList)
                    LEFT JOIN document_slide d ON d.id = s.source_id
                    LEFT JOIN learner_operation lo
                        ON lo.source_id = c.id
                        AND lo.source = 'CHAPTER'
                        AND lo.operation IN (:chapterOperation, 'LAST_SLIDE_VIEWED')
                        AND lo.user_id = :userId
                    GROUP BY c.id
                ) AS chap_data ON chap_data.chapter_id = c.id
                WHERE smm.subject_id = :subjectId
                GROUP BY m.id, m.module_name, m.description, m.thumbnail_id, mo.value
            ) AS module_data
            """, nativeQuery = true)
    String getModuleChapterProgress(
            @Param("subjectId") String subjectId,
            @Param("packageSessionId") String packageSessionId,
            @Param("userId") String userId,
            @Param("moduleOperation") String moduleOperation,
            @Param("chapterOperation") String chapterOperation,
            @Param("slideStatusList") List<String> slideStatusList,
            @Param("chapterToSlideStatusList") List<String> chapterToSlideStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("moduleStatusList") List<String> moduleStatusList);

    boolean existsByChapterIdAndModuleId(String chapterId, String moduleId);

    @Query("SELECT mcm FROM ModuleChapterMapping mcm WHERE mcm.module.id = :moduleId")
    List<ModuleChapterMapping> findByModuleId(@Param("moduleId") String moduleId);

    @Query(value = """
            SELECT json_agg(module_data) AS module_array
            FROM (
                SELECT json_build_object(
                    'module', json_build_object(
                        'id', m.id,
                        'module_name', m.module_name,
                        'description', m.description,
                        'thumbnail_id', m.thumbnail_id
                    ),
                    'chapters', COALESCE(json_agg(jsonb_build_object(
                        'id', c.id,
                        'chapter_name', c.chapter_name,
                        'status', c.status,
                        'file_id', c.file_id,
                        'description', c.description,
                        'video_count', counts.video_count,
                        'pdf_count', counts.pdf_count,
                        'doc_count', counts.doc_count,
                        'question_slide_count', counts.question_slide_count,
                        'assignment_slide_count', counts.assignment_slide_count,
                        'survey_slide_count', counts.survey_slide_count,
                        'unknown_count', counts.unknown_count
                    ) ORDER BY c.created_at) FILTER (WHERE c.id IS NOT NULL), CAST('[]' AS json))
                ) AS module_data
                FROM subject_module_mapping smm
                JOIN modules m ON smm.module_id = m.id AND m.status IN (:moduleStatusList)
                -- The only change is in the following line --
                LEFT JOIN (SELECT DISTINCT module_id, chapter_id FROM module_chapter_mapping) mcm ON mcm.module_id = m.id
                LEFT JOIN chapter c ON c.id = mcm.chapter_id AND c.status IN (:chapterStatusList)
                LEFT JOIN (
                    SELECT
                        c.id AS chapter_id,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'VIDEO' THEN s.id END) AS video_count,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'DOCUMENT' AND d.type = 'PDF' THEN s.id END) AS pdf_count,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'DOCUMENT' AND d.type = 'DOC' THEN s.id END) AS doc_count,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'QUESTION' THEN s.id END) AS question_slide_count,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'ASSIGNMENT' THEN s.id END) AS assignment_slide_count,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'SURVEY' THEN s.id END) AS survey_slide_count,
                        COUNT(DISTINCT CASE WHEN s.source_type NOT IN ('VIDEO', 'DOCUMENT', 'QUESTION', 'ASSIGNMENT', 'SURVEY') OR s.source_type IS NULL THEN s.id END) AS unknown_count
                    FROM chapter c
                    LEFT JOIN chapter_to_slides cs ON cs.chapter_id = c.id AND cs.status IN (:chapterToSlideStatusList)
                    LEFT JOIN slide s ON cs.slide_id = s.id AND s.status IN (:slideStatusList)
                    LEFT JOIN document_slide d ON d.id = s.source_id
                    WHERE c.status IN (:chapterStatusList)
                    GROUP BY c.id
                ) AS counts ON counts.chapter_id = c.id
                WHERE smm.subject_id = :subjectId
                GROUP BY m.id, m.module_name, m.description, m.thumbnail_id
            ) AS module_data
            """, nativeQuery = true)
    String getOpenModuleChapterDetails(
            @Param("subjectId") String subjectId,
            @Param("slideStatusList") List<String> slideStatusList,
            @Param("chapterToSlideStatusList") List<String> chapterToSlideStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("moduleStatusList") List<String> moduleStatusList);

    @Query(value = """
            SELECT json_agg(module_data) AS module_array
            FROM (
                SELECT json_build_object(
                    'module', json_build_object(
                        'id', m.id,
                        'module_name', m.module_name,
                        'description', m.description,
                        'thumbnail_id', m.thumbnail_id
                    ),
                    'percentage_completed', COALESCE(CAST(
                        MAX(CASE
                            WHEN mo.value ~ '^[0-9]+(\\.[0-9]+)?$' THEN mo.value
                            ELSE '0'
                        END) AS FLOAT
                    ), 0.0),
                    'chapters', COALESCE(json_agg(
                        jsonb_build_object(
                            'id', c.id,
                            'chapter_name', c.chapter_name,
                            'status', c.status,
                            'file_id', c.file_id,
                            'description', c.description,
                            'drip_condition', c.drip_condition_json,
                            'percentage_completed', chap_data.percentage_completed,
                            'last_slide_viewed', chap_data.last_slide_viewed,
                            'video_count', chap_data.video_count,
                            'pdf_count', chap_data.pdf_count,
                            'doc_count', chap_data.doc_count,
                            'question_slide_count', chap_data.question_slide_count,
                            'assignment_slide_count', chap_data.assignment_slide_count,
                            'survey_slide_count', chap_data.survey_slide_count,
                            'unknown_count', chap_data.unknown_count,
                            'learner_slides_details', (
                                SELECT json_agg(slide_data ORDER BY slide_order IS NOT NULL, slide_order, created_at DESC) AS slides
                                FROM (
                                    -- VIDEO SLIDES
                                    SELECT DISTINCT ON (s.id)
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
                                            'drip_condition', s.drip_condition_json,
                                            'progress_marker', COALESCE(CAST(lo_video_marker.value AS bigint), NULL),
                                            'percentage_completed', CASE
                                                WHEN lo_video_percent.value IS NULL OR lo_video_percent.value = 'null' THEN NULL
                                                ELSE CAST(lo_video_percent.value AS double precision)
                                            END,
                                            'video_slide', json_build_object(
                                                'id', v.id,
                                                'url', v.url,
                                                'title', v.title,
                                                'description', v.description,
                                                'embedded_type', v.embedded_type,
                                                'embedded_data', v.embedded_data,
                                                'source_type', v.source_type,
                                                'published_url', v.published_url,
                                                'video_length_in_millis', v.video_length,
                                                'published_video_length_in_millis', v.published_video_length,
                                                'questions', COALESCE((
                                                    SELECT json_agg(
                                                        json_build_object(
                                                            'id', q.id,
                                                            'can_skip', q.can_skip,
                                                            'question_response_type', q.question_response_type,
                                                            'question_type', q.question_type,
                                                            'access_level', q.access_level,
                                                            'question_order', q.question_order,
                                                            'question_time_in_millis', q.question_time_in_millis,
                                                            'media_id', q.media_id,
                                                            'auto_evaluation_json', q.auto_evaluation_json,
                                                            'evaluation_type', q.evaluation_type,
                                                            'text_data', json_build_object('id', rt_text.id, 'type', rt_text.type, 'content', rt_text.content),
                                                            'parent_rich_text', CASE WHEN q.parent_rich_text_id IS NOT NULL THEN json_build_object('id', rt_parent.id, 'type', rt_parent.type, 'content', rt_parent.content) ELSE NULL END,
                                                            'explanation_text_data', CASE WHEN q.explanation_text_id IS NOT NULL THEN json_build_object('id', rt_exp.id, 'type', rt_exp.type, 'content', rt_exp.content) ELSE NULL END,
                                                            'options', COALESCE((
                                                                SELECT json_agg(
                                                                    json_build_object(
                                                                        'id', o.id,
                                                                        'media_id', o.media_id,
                                                                        'text', CASE WHEN o.text_id IS NOT NULL THEN json_build_object('id', rt_opt.id, 'type', rt_opt.type, 'content', rt_opt.content) ELSE NULL END,
                                                                        'explanation_text_data', CASE WHEN o.explanation_text_id IS NOT NULL THEN json_build_object('id', rt_opt_exp.id, 'type', rt_opt_exp.type, 'content', rt_opt_exp.content) ELSE NULL END
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
                                                    WHERE q.video_slide_id = v.id AND q.status IN (:videoSlideQuestionStatus)
                                                ), CAST('[]' AS json))
                                            )
                                        ) AS slide_data
                                    FROM slide s
                                    JOIN chapter_to_slides cs ON cs.slide_id = s.id
                                    JOIN chapter ch ON ch.id = cs.chapter_id
                                    JOIN video v ON v.id = s.source_id
                                    LEFT JOIN learner_operation lo_video_marker ON lo_video_marker.source = 'SLIDE' AND lo_video_marker.source_id = s.id AND lo_video_marker.user_id = :userId AND lo_video_marker.operation = 'VIDEO_LAST_TIMESTAMP'
                                    LEFT JOIN learner_operation lo_video_percent ON lo_video_percent.source = 'SLIDE' AND lo_video_percent.source_id = s.id AND lo_video_percent.user_id = :userId AND lo_video_percent.operation = 'PERCENTAGE_VIDEO_WATCHED'
                                    WHERE s.source_type = 'VIDEO' AND ch.id = c.id
                                    AND s.status IN (:slideStatus)
                                    AND cs.status IN (:chapterToSlidesStatus)

                                    UNION ALL

                                    -- DOCUMENT SLIDES
                                    SELECT DISTINCT ON (s.id)
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
                                            'drip_condition', s.drip_condition_json,
                                            'progress_marker', COALESCE(CAST(lo_doc_marker.value AS bigint), NULL),
                                            'percentage_completed', CASE
                                                WHEN lo_doc_percent.value IS NULL OR lo_doc_percent.value = 'null' THEN NULL
                                                ELSE CAST(lo_doc_percent.value AS double precision)
                                            END,
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
                                    JOIN chapter ch ON ch.id = cs.chapter_id
                                    JOIN document_slide d ON d.id = s.source_id
                                    LEFT JOIN learner_operation lo_doc_marker ON lo_doc_marker.source = 'SLIDE' AND lo_doc_marker.source_id = s.id AND lo_doc_marker.user_id = :userId AND lo_doc_marker.operation = 'DOCUMENT_LAST_PAGE'
                                    LEFT JOIN learner_operation lo_doc_percent ON lo_doc_percent.source = 'SLIDE' AND lo_doc_percent.source_id = s.id AND lo_doc_percent.user_id = :userId AND lo_doc_percent.operation = 'PERCENTAGE_DOCUMENT_COMPLETED'
                                    WHERE s.source_type = 'DOCUMENT' AND ch.id = c.id
                                    AND s.status IN (:slideStatus)
                                    AND cs.status IN (:chapterToSlidesStatus)

                                    UNION ALL

                                    -- QUESTION SLIDES
                                    SELECT DISTINCT ON (s.id)
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
                                            'drip_condition', s.drip_condition_json,
                                            'progress_marker', NULL,
                                            'percentage_completed', CASE
                                                WHEN lo_ques_percent.value IS NULL OR lo_ques_percent.value = 'null' THEN NULL
                                                ELSE CAST(lo_ques_percent.value AS double precision)
                                            END,
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
                                                'text_data', json_build_object('id', rt_text.id, 'type', rt_text.type, 'content', rt_text.content),
                                                'parent_rich_text', CASE WHEN q.parent_rich_text_id IS NOT NULL THEN json_build_object('id', rt_parent.id, 'type', rt_parent.type, 'content', rt_parent.content) ELSE NULL END,
                                                'explanation_text_data', CASE WHEN q.explanation_text_id IS NOT NULL THEN json_build_object('id', rt_exp.id, 'type', rt_exp.type, 'content', rt_exp.content) ELSE NULL END,
                                                'options', COALESCE((
                                                    SELECT json_agg(
                                                        json_build_object(
                                                            'id', o.id,
                                                            'media_id', o.media_id,
                                                            'text', CASE WHEN o.text_id IS NOT NULL THEN json_build_object('id', rt_opt.id, 'type', rt_opt.type, 'content', rt_opt.content) ELSE NULL END,
                                                            'explanation_text_data', CASE WHEN o.explanation_text_id IS NOT NULL THEN json_build_object('id', rt_opt_exp.id, 'type', rt_opt_exp.type, 'content', rt_opt_exp.content) ELSE NULL END
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
                                JOIN chapter ch ON ch.id = cs.chapter_id
                                JOIN question_slide q ON q.id = s.source_id
                                LEFT JOIN rich_text_data rt_text ON rt_text.id = q.text_id
                                LEFT JOIN rich_text_data rt_parent ON rt_parent.id = q.parent_rich_text_id
                                LEFT JOIN rich_text_data rt_exp ON rt_exp.id = q.explanation_text_id
                                LEFT JOIN learner_operation lo_ques_percent ON lo_ques_percent.source = 'SLIDE' AND lo_ques_percent.source_id = s.id AND lo_ques_percent.user_id = :userId AND lo_ques_percent.operation = 'PERCENTAGE_QUESTION_COMPLETED'
                                WHERE s.source_type = 'QUESTION' AND ch.id = c.id
                                AND s.status IN (:slideStatus)
                                AND cs.status IN (:chapterToSlidesStatus)

                                UNION ALL

                                -- ASSIGNMENT SLIDES
                                SELECT DISTINCT ON (s.id)
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
                                        'drip_condition', s.drip_condition_json,
                                        'progress_marker', NULL,
                                        'percentage_completed', CASE
                                            WHEN lo_assign_percent.value IS NULL OR lo_assign_percent.value = 'null' THEN NULL
                                            ELSE CAST(lo_assign_percent.value AS double precision)
                                        END,
                                        'assignment_slide', json_build_object(
                                            'id', a.id,
                                            'live_date', a.live_date,
                                            'end_date', a.end_date,
                                            'comma_separated_media_ids', a.comma_separated_media_ids,
                                            're_attempt_count', a.re_attempt_count,
                                            'text_data', CASE
                                                WHEN a.text_id IS NOT NULL THEN json_build_object(
                                                    'id', rt_text.id,
                                                    'type', rt_text.type,
                                                    'content', rt_text.content
                                                ) ELSE NULL
                                            END,
                                            'parent_rich_text', CASE
                                                WHEN a.parent_rich_text_id IS NOT NULL THEN json_build_object(
                                                    'id', rt_parent.id,
                                                    'type', rt_parent.type,
                                                    'content', rt_parent.content
                                                ) ELSE NULL
                                            END,
                                            'questions', COALESCE((
                                                SELECT json_agg(
                                                    json_build_object(
                                                        'id', q.id,
                                                        'question_order', q.question_order,
                                                        'status', q.status,
                                                        'text_data', CASE
                                                            WHEN q.text_id IS NOT NULL THEN json_build_object(
                                                                'id', rtq.id,
                                                                'type', rtq.type,
                                                                'content', rtq.content
                                                            ) ELSE NULL
                                                        END
                                                    )
                                                    ORDER BY q.question_order
                                                )
                                                FROM assignment_slide_question q
                                                LEFT JOIN rich_text_data rtq ON rtq.id = q.text_id
                                                WHERE q.assignment_slide_id = a.id AND q.status IN (:videoSlideQuestionStatus)
                                            ), CAST('[]' AS json))
                                        )
                                    ) AS slide_data
                                FROM slide s
                                JOIN chapter_to_slides cs ON cs.slide_id = s.id
                                JOIN chapter ch ON ch.id = cs.chapter_id
                                JOIN assignment_slide a ON a.id = s.source_id
                                LEFT JOIN rich_text_data rt_text ON rt_text.id = a.text_id
                                LEFT JOIN rich_text_data rt_parent ON rt_parent.id = a.parent_rich_text_id
                                LEFT JOIN learner_operation lo_assign_percent ON lo_assign_percent.source = 'SLIDE' AND lo_assign_percent.source_id = s.id AND lo_assign_percent.user_id = :userId AND lo_assign_percent.operation = 'PERCENTAGE_ASSIGNMENT_COMPLETED'
                                WHERE s.source_type = 'ASSIGNMENT' AND ch.id = c.id
                                AND s.status IN (:slideStatus)
                                AND cs.status IN (:chapterToSlidesStatus)

                                UNION ALL

                                -- QUIZ SLIDES
                                SELECT DISTINCT ON (s.id)
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
                                        'drip_condition', s.drip_condition_json,
                                        'progress_marker', NULL, -- Assuming no specific marker for quizzes, adjust if needed
                                        'percentage_completed', CASE
                                            WHEN lo_quiz_percent.value IS NULL OR lo_quiz_percent.value = 'null' THEN NULL
                                            ELSE CAST(lo_quiz_percent.value AS double precision)
                                        END,
                                        'quiz_slide', json_build_object(
                                            'id', qs.id,
                                            'title', qs.title,
                                            'description', CASE WHEN qs_description_rt.id IS NOT NULL THEN json_build_object('id', qs_description_rt.id, 'type', qs_description_rt.type, 'content', qs_description_rt.content) ELSE NULL END,
                                            'questions', COALESCE((
                                                                                SELECT json_agg(
                                                                                    json_build_object(
                                                                                        'id', q.id,
                                                                                        'question_response_type', q.question_response_type,
                                                                                        'question_type', q.question_type,
                                                                                        'access_level', q.access_level,
                                                                                        'question_order', q.question_order,
                                                                                        'status', q.status,
                                                                                        'media_id', q.media_id,
                                                                                        'can_skip', q.can_skip,
                                                                                        'auto_evaluation_json', q.auto_evaluation_json,
                                                                                        'evaluation_type', q.evaluation_type,
                                                                                        'text', json_build_object('id', q_text_rt.id, 'type', q_text_rt.type, 'content', q_text_rt.content),
                                                                                        'parent_rich_text', CASE WHEN q.parent_rich_text_id IS NOT NULL THEN json_build_object('id', q_parent_rt.id, 'type', q_parent_rt.type, 'content', q_parent_rt.content) ELSE NULL END,
                                                                                        'explanation_text', CASE WHEN q.explanation_text_id IS NOT NULL THEN json_build_object('id', q_exp_rt.id, 'type', q_exp_rt.type, 'content', q_exp_rt.content) ELSE NULL END,
                                                                                        'options', COALESCE((
                                                                                            SELECT json_agg(
                                                                                                json_build_object(
                                                                                                    'id', o.id,
                                                                                                    'media_id', o.media_id,
                                                                                                    'text', CASE WHEN o.text_id IS NOT NULL THEN json_build_object('id', o_text_rt.id, 'type', o_text_rt.type, 'content', o_text_rt.content) ELSE NULL END,
                                                                                                    'explanation_text_data', CASE WHEN o.explanation_text_id IS NOT NULL THEN json_build_object('id', o_exp_rt.id, 'type', o_exp_rt.type, 'content', o_exp_rt.content) ELSE NULL END
                                                                                                )
                                                                                            )
                                                                                            FROM quiz_slide_question_options o
                                                                                            LEFT JOIN rich_text_data o_text_rt ON o_text_rt.id = o.text_id
                                                                                            LEFT JOIN rich_text_data o_exp_rt ON o_exp_rt.id = o.explanation_text_id
                                                                                            WHERE o.quiz_slide_question_id = q.id
                                                                                        ), CAST('[]' AS json))
                                                                                    )
                                                                                    ORDER BY q.question_order
                                                                                )
                                                                                FROM quiz_slide_question q
                                                                                LEFT JOIN rich_text_data q_text_rt ON q_text_rt.id = q.text_id
                                                                                LEFT JOIN rich_text_data q_parent_rt ON q_parent_rt.id = q.parent_rich_text_id
                                                                                LEFT JOIN rich_text_data q_exp_rt ON q_exp_rt.id = q.explanation_text_id
                                                                                WHERE q.quiz_slide_id = qs.id
                                                                                AND q.status IN (:videoSlideQuestionStatus)
                                                                            ), CAST('[]' AS json))
                                                                        )
                                                                    ) AS slide_data
                                FROM slide s
                                JOIN chapter_to_slides cs ON cs.slide_id = s.id
                                JOIN chapter ch ON ch.id = cs.chapter_id
                                JOIN quiz_slide qs ON qs.id = s.source_id
                                LEFT JOIN rich_text_data qs_description_rt ON qs_description_rt.id = qs.description
                                LEFT JOIN learner_operation lo_quiz_percent ON lo_quiz_percent.source = 'SLIDE' AND lo_quiz_percent.source_id = s.id AND lo_quiz_percent.user_id = :userId AND lo_quiz_percent.operation = 'PERCENTAGE_QUIZ_COMPLETED'
                                WHERE s.source_type = 'QUIZ' AND ch.id = c.id
                                AND s.status IN (:slideStatus)
                                AND cs.status IN (:chapterToSlidesStatus)
                            ) AS slide_data
                            )
                        ) ORDER BY cpsm.chapter_order ASC NULLS LAST
                    ) FILTER (WHERE c.id IS NOT NULL), CAST('[]' AS json))
                ) AS module_data
                FROM subject_module_mapping smm
                JOIN modules m ON smm.module_id = m.id AND m.status IN (:moduleStatusList)
                LEFT JOIN learner_operation mo
                    ON mo.source_id = m.id
                    AND mo.source = 'MODULE'
                    AND mo.operation = :moduleOperation
                    AND mo.user_id = :userId
                LEFT JOIN module_chapter_mapping mcm ON mcm.module_id = m.id
                LEFT JOIN chapter c ON c.id = mcm.chapter_id AND c.status IN (:chapterStatusList)
                JOIN chapter_package_session_mapping cpsm
                    ON cpsm.chapter_id = c.id
                    AND cpsm.package_session_id = :packageSessionId
                    AND cpsm.status IN (:chapterStatusList)
                LEFT JOIN (
                    SELECT
                        c.id AS chapter_id,
                        MAX(CASE
                            WHEN lo.operation = :chapterOperation AND lo.value ~ '^[0-9]+(\\.[0-9]+)?$'
                            THEN CAST(lo.value AS FLOAT)
                            ELSE 0.0
                        END) AS percentage_completed,
                        MAX(CASE WHEN lo.operation = 'LAST_SLIDE_VIEWED' THEN lo.value END) AS last_slide_viewed,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'VIDEO' THEN s.id END) AS video_count,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'DOCUMENT' AND d.type = 'PDF' THEN s.id END) AS pdf_count,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'DOCUMENT' AND d.type = 'DOC' THEN s.id END) AS doc_count,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'QUESTION' THEN s.id END) AS question_slide_count,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'ASSIGNMENT' THEN s.id END) AS assignment_slide_count,
                        COUNT(DISTINCT CASE WHEN s.source_type = 'SURVEY' THEN s.id END) AS survey_slide_count,
                        COUNT(DISTINCT CASE
                            WHEN s.source_type NOT IN ('VIDEO', 'DOCUMENT', 'QUESTION', 'ASSIGNMENT', 'SURVEY')
                                 OR s.source_type IS NULL THEN s.id
                        END) AS unknown_count
                    FROM chapter c
                    LEFT JOIN chapter_to_slides cs ON cs.chapter_id = c.id AND cs.status IN (:chapterToSlidesStatus)
                    LEFT JOIN slide s ON cs.slide_id = s.id AND s.status IN (:slideStatus)
                    LEFT JOIN document_slide d ON d.id = s.source_id
                    LEFT JOIN learner_operation lo
                        ON lo.source_id = c.id
                        AND lo.source = 'CHAPTER'
                        AND lo.operation IN (:chapterOperation, 'LAST_SLIDE_VIEWED')
                        AND lo.user_id = :userId
                    GROUP BY c.id
                ) AS chap_data ON chap_data.chapter_id = c.id
                WHERE smm.subject_id = :subjectId
                GROUP BY m.id, m.module_name, m.description, m.thumbnail_id, mo.value
            ) AS module_data
            """, nativeQuery = true)
    String getModuleChapterProgressWithSlides(
            @Param("subjectId") String subjectId,
            @Param("packageSessionId") String packageSessionId,
            @Param("userId") String userId,
            @Param("moduleOperation") String moduleOperation,
            @Param("chapterOperation") String chapterOperation,
            @Param("slideStatus") List<String> slideStatus,
            @Param("chapterToSlidesStatus") List<String> chapterToSlidesStatus,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("moduleStatusList") List<String> moduleStatusList,
            @Param("videoSlideQuestionStatus") List<String> videoSlideQuestionStatus);
}
