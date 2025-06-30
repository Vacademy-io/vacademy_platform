package vacademy.io.admin_core_service.features.slide.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.security.core.parameters.P;
import vacademy.io.admin_core_service.features.slide.dto.*;
import vacademy.io.admin_core_service.features.slide.entity.Slide;

import java.util.List;
import java.util.Optional;

public interface SlideRepository extends JpaRepository<Slide, String> {
    @Query("""
                SELECT new vacademy.io.admin_core_service.features.slide.dto.SlideCountProjection(
                    COALESCE(SUM(CASE WHEN s.sourceType = 'VIDEO' THEN 1 ELSE 0 END), 0) AS videoCount,
                    COALESCE(SUM(CASE WHEN s.sourceType = 'DOCUMENT' AND EXISTS (SELECT 1 FROM DocumentSlide d WHERE d.id = s.sourceId AND d.type = 'PDF') THEN 1 ELSE 0 END), 0) AS pdfCount,
                    COALESCE(SUM(CASE WHEN s.sourceType = 'DOCUMENT' AND EXISTS (SELECT 1 FROM DocumentSlide d WHERE d.id = s.sourceId AND d.type = 'DOC') THEN 1 ELSE 0 END), 0) AS docCount,
                    COALESCE(SUM(CASE WHEN s.sourceType NOT IN ('VIDEO', 'DOCUMENT') THEN 1 ELSE 0 END), 0) AS unknownCount
                )
                FROM ChapterToSlides cts
                JOIN Slide s ON cts.slide.id = s.id
                WHERE cts.chapter.id = :chapterId
                AND cts.status != 'DELETED'
                AND s.status != 'DELETED'
            """)
    SlideCountProjection countSlidesByChapterId(@Param("chapterId") String chapterId);

    @Query(value = """
            SELECT s.id AS slideId,
                   s.title AS slideTitle,
                   s.description AS slideDescription,
                   s.source_type AS sourceType,
                   s.status AS status,
                   s.image_file_id AS imageFileId,
                   s.last_sync_date AS lastSyncDate,
                   ds.id AS documentId,
                   ds.title AS documentTitle,
                   ds.cover_file_id AS documentCoverFileId,
                   ds.type AS documentType,
                   ds.data AS documentData,
                   vs.id AS videoId,
                   vs.title AS videoTitle,
                   vs.url AS videoUrl,
                   vs.source_type AS videoSourceType,
                   vs.description AS videoDescription,
                   COALESCE(cts.slide_order, 9999) AS slideOrder,
                   vs.published_url AS publishedUrl,
                   ds.published_data AS publishedData
            FROM chapter_to_slides cts
            JOIN slide s ON cts.slide_id = s.id
            JOIN chapter ch ON cts.chapter_id = ch.id
            LEFT JOIN document_slide ds ON ds.id = s.source_id AND s.source_type = 'DOCUMENT'
            LEFT JOIN video vs ON vs.id = s.source_id AND s.source_type = 'VIDEO'
            WHERE ch.id = :chapterId
              AND s.status IN :status
              AND cts.status != 'DELETED'
            ORDER BY
                cts.slide_order IS NOT NULL,
                cts.slide_order ASC,
                s.created_at DESC
            """, nativeQuery = true)
    List<SlideDetailProjection> findSlideDetailsByChapterId(
            @Param("chapterId") String chapterId,
            @Param("status") List<String> status
    );

    @Query(value = """
                SELECT
                    s.id AS slideId,
                    s.title AS slideTitle,
                    s.description AS slideDescription,
                    s.source_type AS sourceType,
                    s.status AS status,
                    s.image_file_id AS imageFileId,

                    ds.id AS documentId,
                    ds.title AS documentTitle,
                    ds.cover_file_id AS documentCoverFileId,
                    ds.type AS documentType,


                    vs.id AS videoId,
                    vs.title AS videoTitle,
                    vs.description AS videoDescription,
                    vs.published_url AS publishedUrl,
                    vs.source_type AS videoSourceType,
                    ds.published_data AS publishedData,
                    cts.slide_order AS slideOrder

                FROM slide s
                JOIN activity_log al ON al.slide_id = s.id
                JOIN chapter_to_slides cts ON s.id = cts.slide_id
                JOIN chapter ch ON cts.chapter_id = ch.id

                LEFT JOIN document_slide ds ON ds.id = s.source_id AND s.source_type = 'DOCUMENT'
                LEFT JOIN video vs ON vs.id = s.source_id AND s.source_type = 'VIDEO'

                WHERE al.user_id = :userId
                AND s.status IN :status
                AND (al.percentage_watched IS NULL OR al.percentage_watched != 100)
                AND cts.status != 'DELETED'

                ORDER BY
                    CASE WHEN cts.slide_order IS NULL THEN 0 ELSE 1 END,
                    cts.slide_order ASC,
                    al.updated_at DESC,
                    s.id

                LIMIT 5
            """, nativeQuery = true)
    List<SlideDetailProjection> findRecentIncompleteSlidesByUserId(
            @Param("userId") String userId,
            @Param("status") List<String> status);


    @Query(value = """
                SELECT
                    s.id AS slideId,
                    s.title AS slideTitle,
                    s.description AS slideDescription,
                    s.source_type AS sourceType,
                    s.status AS status,
                    s.image_file_id AS imageFileId,

                    ds.id AS documentId,
                    ds.title AS documentTitle,
                    ds.cover_file_id AS documentCoverFileId,
                    ds.type AS documentType,
                    ds.published_data AS publishedData,

                    vs.id AS videoId,
                    vs.title AS videoTitle,
                    vs.description AS videoDescription,
                    vs.published_url AS publishedUrl,
                    vs.source_type AS videoSourceType,
                    cts.slide_order AS slideOrder,

                    COALESCE(NULLIF(doc_percent.value, ''), '0') AS percentageDocumentWatched,
                    COALESCE(NULLIF(doc_last.value, ''), '0') AS documentLastPage,
                    doc_last.updated_at AS documentLastUpdated,

                    COALESCE(NULLIF(vid_percent.value, ''), '0') AS percentageVideoWatched,
                    COALESCE(NULLIF(vid_last.value, ''), '0') AS videoLastTimestamp,
                    vid_last.updated_at AS videoLastUpdated

                FROM chapter_to_slides cts
                JOIN slide s ON cts.slide_id = s.id
                JOIN chapter ch ON cts.chapter_id = ch.id

                LEFT JOIN document_slide ds ON ds.id = s.source_id AND s.source_type = 'DOCUMENT'
                LEFT JOIN video vs ON vs.id = s.source_id AND s.source_type = 'VIDEO'

                LEFT JOIN learner_operation doc_percent ON doc_percent.source = 'SLIDE'
                    AND doc_percent.source_id = s.id
                    AND s.source_type = 'DOCUMENT'
                    AND doc_percent.operation = 'PERCENTAGE_DOCUMENT_WATCHED'
                    AND doc_percent.user_id = :userId

                LEFT JOIN learner_operation doc_last ON doc_last.source = 'SLIDE'
                    AND doc_last.source_id = s.id
                    AND s.source_type = 'DOCUMENT'
                    AND doc_last.operation = 'DOCUMENT_LAST_PAGE'
                    AND doc_last.user_id = :userId

                LEFT JOIN learner_operation vid_percent ON vid_percent.source = 'SLIDE'
                    AND vid_percent.source_id = s.id
                    AND s.source_type = 'VIDEO'
                    AND vid_percent.operation = 'PERCENTAGE_VIDEO_WATCHED'
                    AND vid_percent.user_id = :userId

                LEFT JOIN learner_operation vid_last ON vid_last.source = 'SLIDE'
                    AND vid_last.source_id = s.id
                    AND s.source_type = 'VIDEO'
                    AND vid_last.operation = 'VIDEO_LAST_TIMESTAMP'
                    AND vid_last.user_id = :userId

                WHERE ch.id = :chapterId
                AND s.status IN (:status)
                AND cts.status != 'DELETED'
                ORDER BY
                    CASE
                        WHEN cts.slide_order IS NULL THEN 0
                        ELSE 1
                    END,
                    cts.slide_order ASC
            """, nativeQuery = true)
    List<SlideDetailWithOperationProjection> findSlideDetailsWithOperationByChapterId(
            @Param("userId") String userId,
            @Param("chapterId") String chapterId,
            @Param("status") List<String> status
    );

    @Query(value = """
            SELECT s.id AS slideId,
                   s.title AS slideTitle,
                   s.description AS slideDescription,
                   s.source_type AS sourceType,
                   s.status AS status,
                   s.image_file_id AS imageFileId,
                   ds.id AS documentId,
                   ds.title AS documentTitle,
                   ds.cover_file_id AS documentCoverFileId,
                   ds.type AS documentType,
                   vs.id AS videoId,
                   vs.source_type AS videoSourceType,
                   vs.title AS videoTitle,
                   vs.description AS videoDescription,
                   COALESCE(cts.slide_order, 9999) AS slideOrder,
                   vs.published_url AS publishedUrl,
                   ds.published_data AS publishedData
            FROM chapter_to_slides cts
            JOIN slide s ON cts.slide_id = s.id
            JOIN chapter ch ON cts.chapter_id = ch.id
            LEFT JOIN document_slide ds ON ds.id = s.source_id AND s.source_type = 'DOCUMENT'
            LEFT JOIN video vs ON vs.id = s.source_id AND s.source_type = 'VIDEO'
            WHERE ch.id = :chapterId
              AND s.status IN :status
              AND cts.status != 'DELETED'
            ORDER BY
                cts.slide_order IS NOT NULL,
                cts.slide_order ASC,
                s.created_at DESC
            """, nativeQuery = true)
    List<SlideDetailProjection> findLearnerSlideDetailsByChapterId(
            @Param("chapterId") String chapterId,
            @Param("status") List<String> status
    );

    @Query(value = """
                SELECT DISTINCT ON (s.id)\s
                    s.id AS slideId,\s
                    s.title AS slideTitle,\s
                    s.description AS slideDescription,\s
                    s.source_type AS sourceType,\s
                    s.status AS status,\s
                    s.image_file_id AS imageFileId,

                    -- Merge both operations into one progressMarker field
                    COALESCE(
                        CASE WHEN lo.operation = 'VIDEO_LAST_TIMESTAMP' THEN CAST(lo.value AS BIGINT) END,
                        CASE WHEN lo.operation = 'DOCUMENT_LAST_PAGE' THEN CAST(lo.value AS BIGINT) END
                    ) AS progressMarker,

                    ps.package_id AS packageId,\s
                    ps.level_id AS levelId,
                    ch.id AS chapterId,
                    m.id AS moduleId,
                    sub.id AS subjectId

                FROM slide s\s
                JOIN activity_log al ON al.slide_id = s.id\s
                JOIN chapter_to_slides cts ON s.id = cts.slide_id AND cts.status IN :chapterSlideStatus \s
                JOIN chapter ch ON cts.chapter_id = ch.id AND ch.status IN :chapterStatus \s
                JOIN package_session ps ON ps.id = :packageSessionId AND ps.status IN :packageSessionStatus \s
                JOIN module_chapter_mapping mtc ON mtc.chapter_id = ch.id \s
                JOIN modules m ON mtc.module_id = m.id AND m.status IN :moduleStatus\s
                JOIN subject_module_mapping smm ON smm.module_id = m.id \s
                JOIN subject sub ON smm.subject_id = sub.id AND sub.status IN :subjectStatus \s

                LEFT JOIN document_slide ds ON ds.id = s.source_id AND s.source_type = 'DOCUMENT'\s
                LEFT JOIN video vs ON vs.id = s.source_id AND s.source_type = 'VIDEO'\s
                LEFT JOIN learner_operation lo ON lo.user_id = :userId\s
                                                  AND lo.source = 'SLIDE'\s
                                                  AND lo.source_id = s.id \s

                WHERE al.user_id = :userId\s
                AND s.status IN :slideStatus \s
                AND (al.percentage_watched IS NULL OR al.percentage_watched != 100)\s
                LIMIT 5
            """, nativeQuery = true)
    List<LearnerRecentSlides> findRecentIncompleteSlides(
            @Param("userId") String userId,
            @Param("packageSessionId") String packageSessionId,
            @Param("slideStatus") List<String> slideStatus,
            @Param("chapterSlideStatus") List<String> chapterSlideStatus,
            @Param("chapterStatus") List<String> chapterStatus,
            @Param("moduleStatus") List<String> moduleStatus,
            @Param("subjectStatus") List<String> subjectStatus,
            @Param("packageSessionStatus") List<String> packageSessionStatus);

    @Query(
            value = """
                    SELECT json_agg(slide_data ORDER BY slide_order IS NOT NULL, slide_order, created_at DESC) AS slides
                    FROM (
                        -- VIDEO SLIDES
                        SELECT\s
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
                                                'question_response_type', q.question_response_type,
                                                'question_type', q.question_type,
                                                'access_level', q.access_level,
                                                'question_order', q.question_order,
                                                'question_time_in_millis', q.question_time_in_millis,
                                                'media_id', q.media_id,
                                                'can_skip', q.can_skip,
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
                                        AND q.status IN (:videoSlideQuestionStatus)  -- Ensure you use the status if needed
                                    ), CAST('[]' AS json))
                                )
                            ) AS slide_data
                        FROM slide s
                        JOIN chapter_to_slides cs ON cs.slide_id = s.id
                        JOIN chapter c ON c.id = cs.chapter_id
                        JOIN video v ON v.id = s.source_id
                        WHERE s.source_type = 'VIDEO' AND c.id = :chapterId
                        AND s.status IN (:slideStatus)
                        AND cs.status IN (:chapterToSlidesStatus)

                        UNION ALL

                        -- DOCUMENT SLIDES
                        SELECT\s
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
                        JOIN chapter c ON c.id = cs.chapter_id
                        JOIN document_slide d ON d.id = s.source_id
                        WHERE s.source_type = 'DOCUMENT' AND c.id = :chapterId
                        AND s.status IN (:slideStatus)
                        AND cs.status IN (:chapterToSlidesStatus)

                        UNION ALL

                        -- QUESTION SLIDES
                        SELECT\s
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
                        JOIN chapter c ON c.id = cs.chapter_id
                        JOIN question_slide q ON q.id = s.source_id
                        LEFT JOIN rich_text_data rt_text ON rt_text.id = q.text_id
                        LEFT JOIN rich_text_data rt_parent ON rt_parent.id = q.parent_rich_text_id
                        LEFT JOIN rich_text_data rt_exp ON rt_exp.id = q.explanation_text_id
                        WHERE s.source_type = 'QUESTION' AND c.id = :chapterId
                        AND s.status IN (:slideStatus)
                        AND cs.status IN (:chapterToSlidesStatus)

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
                                    'text_data', CASE
                                        WHEN a.text_id IS NOT NULL THEN json_build_object(
                                            'id', rt_text.id,
                                            'type', 'RICH_TEXT',
                                            'content', rt_text.content
                                        ) ELSE NULL
                                    END,
                                    'parent_rich_text', CASE
                                        WHEN a.parent_rich_text_id IS NOT NULL THEN json_build_object(
                                            'id', rt_parent.id,
                                            'type', 'RICH_TEXT',
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
                                                        'type', 'RICH_TEXT',
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
                        JOIN chapter c ON c.id = cs.chapter_id
                        JOIN assignment_slide a ON a.id = s.source_id
                        LEFT JOIN rich_text_data rt_text ON rt_text.id = a.text_id
                        LEFT JOIN rich_text_data rt_parent ON rt_parent.id = a.parent_rich_text_id
                        WHERE s.source_type = 'ASSIGNMENT' AND c.id = :chapterId
                        AND s.status IN (:slideStatus)
                        AND cs.status IN (:chapterToSlidesStatus)
                    ) AS all_slides
    """,
            nativeQuery = true
    )
    String getSlidesByChapterId(
            @Param("chapterId") String chapterId,
            @Param("slideStatus") List<String> slideStatus,
            @Param("chapterToSlidesStatus") List<String> chapterToSlidesStatus,
            @Param("videoSlideQuestionStatus") List<String> videoSlideQuestionStatus
    );

    @Query(value = """
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
                        WHERE q.video_slide_id = v.id AND q.status IN (:videoSlideQuestionStatus)
                    ), CAST('[]' AS json))
                )
            ) AS slide_data
        FROM slide s
        JOIN chapter_to_slides cs ON cs.slide_id = s.id
        JOIN chapter c ON c.id = cs.chapter_id
        JOIN video v ON v.id = s.source_id
        LEFT JOIN learner_operation lo_video_marker ON lo_video_marker.source = 'SLIDE' AND lo_video_marker.source_id = s.id AND lo_video_marker.user_id = :userId AND lo_video_marker.operation = 'VIDEO_LAST_TIMESTAMP'
        LEFT JOIN learner_operation lo_video_percent ON lo_video_percent.source = 'SLIDE' AND lo_video_percent.source_id = s.id AND lo_video_percent.user_id = :userId AND lo_video_percent.operation = 'PERCENTAGE_VIDEO_WATCHED'
        WHERE s.source_type = 'VIDEO' AND c.id = :chapterId
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
        JOIN chapter c ON c.id = cs.chapter_id
        JOIN document_slide d ON d.id = s.source_id
        LEFT JOIN learner_operation lo_doc_marker ON lo_doc_marker.source = 'SLIDE' AND lo_doc_marker.source_id = s.id AND lo_doc_marker.user_id = :userId AND lo_doc_marker.operation = 'DOCUMENT_LAST_PAGE'
        LEFT JOIN learner_operation lo_doc_percent ON lo_doc_percent.source = 'SLIDE' AND lo_doc_percent.source_id = s.id AND lo_doc_percent.user_id = :userId AND lo_doc_percent.operation = 'PERCENTAGE_DOCUMENT_READ'
        WHERE s.source_type = 'DOCUMENT' AND c.id = :chapterId
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
        JOIN chapter c ON c.id = cs.chapter_id
        JOIN question_slide q ON q.id = s.source_id
        LEFT JOIN rich_text_data rt_text ON rt_text.id = q.text_id
        LEFT JOIN rich_text_data rt_parent ON rt_parent.id = q.parent_rich_text_id
        LEFT JOIN rich_text_data rt_exp ON rt_exp.id = q.explanation_text_id
        LEFT JOIN learner_operation lo_ques_percent ON lo_ques_percent.source = 'SLIDE' AND lo_ques_percent.source_id = s.id AND lo_ques_percent.user_id = :userId AND lo_ques_percent.operation = 'PERCENTAGE_QUESTION_COMPLETED'
        WHERE s.source_type = 'QUESTION' AND c.id = :chapterId
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
                            'type', 'RICH_TEXT',
                            'content', rt_text.content
                        ) ELSE NULL
                    END,
                    'parent_rich_text', CASE
                        WHEN a.parent_rich_text_id IS NOT NULL THEN json_build_object(
                            'id', rt_parent.id,
                            'type', 'RICH_TEXT',
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
                                        'type', 'RICH_TEXT',
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
        JOIN chapter c ON c.id = cs.chapter_id
        JOIN assignment_slide a ON a.id = s.source_id
        LEFT JOIN rich_text_data rt_text ON rt_text.id = a.text_id
        LEFT JOIN rich_text_data rt_parent ON rt_parent.id = a.parent_rich_text_id
        LEFT JOIN learner_operation lo_assign_percent ON lo_assign_percent.source = 'SLIDE' AND lo_assign_percent.source_id = s.id AND lo_assign_percent.user_id = :userId AND lo_assign_percent.operation = 'PERCENTAGE_ASSIGNMENT_COMPLETED'
        WHERE s.source_type = 'ASSIGNMENT' AND c.id = :chapterId
        AND s.status IN (:slideStatus)
        AND cs.status IN (:chapterToSlidesStatus)
    ) AS slide_data
""", nativeQuery = true)
    String getSlidesByChapterId(
            @Param("chapterId") String chapterId,
            @Param("userId") String userId,
            @Param("slideStatus") List<String> slideStatus,
            @Param("chapterToSlidesStatus") List<String> chapterToSlidesStatus,
            @Param("videoSlideQuestionStatus") List<String> videoSlideQuestionStatus
    );


    @Query(value = """
    SELECT
        cpsm.created_at AS createdAt,
        c.id AS topChapterId,
        cpsm.package_session_id AS packageSessionId,
        sub.id AS subjectId
    FROM slide s
    JOIN chapter_to_slides cs ON cs.slide_id = s.id
    JOIN chapter c ON c.id = cs.chapter_id
    JOIN chapter_package_session_mapping cpsm ON cpsm.chapter_id = c.id
    JOIN module_chapter_mapping mcm ON mcm.chapter_id = c.id
    JOIN modules m ON m.id = mcm.module_id
    JOIN subject_module_mapping smm ON smm.module_id = m.id
    JOIN subject sub ON sub.id = smm.subject_id
    JOIN subject_session sps ON sps.subject_id = sub.id
    WHERE
        s.id = :slideId
        AND sub.status IN :subjectStatusList
        AND m.status IN :moduleStatusList
        AND c.status IN :chapterStatusList
        AND cpsm.status IN :chapterToSessionStatusList
        AND s.status IN :slideStatusList
        AND cs.status IN :slideStatusList
    LIMIT 1
    """, nativeQuery = true)
    Optional<SlideMetadataProjection> findSlideMetadataBySlideId(
            @Param("slideId") String slideId,
            @Param("subjectStatusList") List<String> subjectStatusList,
            @Param("moduleStatusList") List<String> moduleStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("chapterToSessionStatusList") List<String> chapterToSessionStatusList,
            @Param("slideStatusList") List<String> slideStatusList
    );

    @Query(value = """
    SELECT
        s.source_type AS sourceType,
        COUNT(DISTINCT s.id) AS slideCount
    FROM slide s
    JOIN chapter_to_slides cs ON cs.slide_id = s.id
    JOIN chapter c ON c.id = cs.chapter_id
    JOIN module_chapter_mapping mcm ON mcm.chapter_id = c.id
    JOIN modules m ON m.id = mcm.module_id
    JOIN subject_module_mapping smm ON smm.module_id = m.id
    JOIN subject sub ON sub.id = smm.subject_id
    JOIN subject_session ss ON ss.subject_id = sub.id
    JOIN chapter_package_session_mapping cpsm ON cpsm.chapter_id = c.id
    WHERE
        ss.session_id = :sessionId
        AND cpsm.package_session_id = :sessionId
        AND sub.status IN :subjectStatusList
        AND m.status IN :moduleStatusList
        AND c.status IN :chapterStatusList
        AND cs.status IN :slideStatusList
        AND s.status IN :slideStatusList
        AND cpsm.status IN :chapterPackageStatusList
    GROUP BY s.source_type
""", nativeQuery = true)
    List<SlideTypeCountProjection> getSlideCountsBySourceType(
            @Param("sessionId") String sessionId,
            @Param("subjectStatusList") List<String> subjectStatusList,
            @Param("moduleStatusList") List<String> moduleStatusList,
            @Param("chapterStatusList") List<String> chapterStatusList,
            @Param("slideStatusList") List<String> slideStatusList,
            @Param("chapterPackageStatusList") List<String> chapterPackageStatusList
    );
    @Query(value = """
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
                'progress_marker', NULL,
                'percentage_completed', NULL,
                'video_slide', json_build_object(
                    'id', v.id,
                    'url', v.url,
                    'title', v.title,
                    'description', v.description,
                    'source_type', v.source_type,
                    'published_url', v.published_url,
                    'video_length_in_millis', v.video_length,
                    'published_video_length_in_millis', v.published_video_length,
                    'embedded_type', v.embedded_type,
                    'embedded_data', v.embedded_data,
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
                        WHERE q.video_slide_id = v.id AND q.status IN (:videoSlideQuestionStatus)
                    ), CAST('[]' AS json))
                )
            ) AS slide_data
        FROM slide s
        JOIN chapter_to_slides cs ON cs.slide_id = s.id
        JOIN chapter c ON c.id = cs.chapter_id
        JOIN video v ON v.id = s.source_id
        WHERE s.source_type = 'VIDEO' AND c.id = :chapterId
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
                'progress_marker', NULL,
                'percentage_completed', NULL,
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
        JOIN chapter c ON c.id = cs.chapter_id
        JOIN document_slide d ON d.id = s.source_id
        WHERE s.source_type = 'DOCUMENT' AND c.id = :chapterId
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
                'progress_marker', NULL,
                'percentage_completed', NULL,
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
        JOIN chapter c ON c.id = cs.chapter_id
        JOIN question_slide q ON q.id = s.source_id
        LEFT JOIN rich_text_data rt_text ON rt_text.id = q.text_id
        LEFT JOIN rich_text_data rt_parent ON rt_parent.id = q.parent_rich_text_id
        LEFT JOIN rich_text_data rt_exp ON rt_exp.id = q.explanation_text_id
        WHERE s.source_type = 'QUESTION' AND c.id = :chapterId
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
                'progress_marker', NULL,
                'percentage_completed', NULL,
                'assignment_slide', json_build_object(
                    'id', a.id,
                    'live_date', a.live_date,
                    'end_date', a.end_date,
                    'comma_separated_media_ids', a.comma_separated_media_ids,
                    're_attempt_count', a.re_attempt_count,
                    'text_data', CASE
                        WHEN a.text_id IS NOT NULL THEN json_build_object(
                            'id', rt_text.id, 'type', 'RICH_TEXT', 'content', rt_text.content
                        ) ELSE NULL
                    END,
                    'parent_rich_text', CASE
                        WHEN a.parent_rich_text_id IS NOT NULL THEN json_build_object(
                            'id', rt_parent.id, 'type', 'RICH_TEXT', 'content', rt_parent.content
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
                                        'id', rtq.id, 'type', 'RICH_TEXT', 'content', rtq.content
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
        JOIN chapter c ON c.id = cs.chapter_id
        JOIN assignment_slide a ON a.id = s.source_id
        LEFT JOIN rich_text_data rt_text ON rt_text.id = a.text_id
        LEFT JOIN rich_text_data rt_parent ON rt_parent.id = a.parent_rich_text_id
        WHERE s.source_type = 'ASSIGNMENT' AND c.id = :chapterId
        AND s.status IN (:slideStatus)
        AND cs.status IN (:chapterToSlidesStatus)
    ) AS slide_data
""", nativeQuery = true)
    String getSlidesByChapterIdOpen(
            @Param("chapterId") String chapterId,
            @Param("slideStatus") List<String> slideStatus,
            @Param("chapterToSlidesStatus") List<String> chapterToSlidesStatus,
            @Param("videoSlideQuestionStatus") List<String> videoSlideQuestionStatus
    );
}
