package vacademy.io.admin_core_service.features.learner_operation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.learner_operation.entity.LearnerOperation;

import java.util.Optional;

public interface LearnerOperationRepository extends JpaRepository<LearnerOperation, String> {
        @Query(value = "SELECT * FROM learner_operation " +
                        "WHERE user_id = :userId " +
                        "AND source = :source " +
                        "AND source_id = :sourceId " +
                        "AND operation = :operation " +
                        "ORDER BY updated_at DESC " + // Order by latest updated_at
                        "LIMIT 1", nativeQuery = true)
        Optional<LearnerOperation> findByUserIdAndSourceAndSourceIdAndOperation(
                        @Param("userId") String userId,
                        @Param("source") String source,
                        @Param("sourceId") String sourceId,
                        @Param("operation") String operation);

        @Modifying
        @Query("DELETE FROM LearnerOperation lo WHERE lo.source = :source AND lo.sourceId = :sourceId AND lo.operation = :operation AND lo.userId = :userId")
        void deleteBySourceAndSourceIdAndOperationAndUserId(String source, String sourceId, String operation,
                        String userId);

        /**
         * Atomic upsert on the logical key (backed by the unique index from
         * V409). Replaces the read-then-write in LearnerOperationService, which
         * raced under the async cascade and produced duplicate rows.
         */
        @Modifying
        @Query(value = "INSERT INTO learner_operation (id, user_id, source, source_id, operation, value) " +
                        "VALUES (:id, :userId, :source, :sourceId, :operation, :value) " +
                        "ON CONFLICT (user_id, source, source_id, operation) " +
                        "DO UPDATE SET value = EXCLUDED.value", nativeQuery = true)
        void upsertOperation(
                        @Param("id") String id,
                        @Param("userId") String userId,
                        @Param("source") String source,
                        @Param("sourceId") String sourceId,
                        @Param("operation") String operation,
                        @Param("value") String value);

        /**
         * Find all learner operations for a user within a date range
         * Used for student analysis report generation
         */
        @Query(value = "SELECT * FROM learner_operation " +
                        "WHERE user_id = :userId " +
                        "AND created_at BETWEEN :startDate AND :endDate " +
                        "ORDER BY created_at DESC", nativeQuery = true)
        java.util.List<LearnerOperation> findByUserIdAndDateRange(
                        @Param("userId") String userId,
                        @Param("startDate") java.sql.Timestamp startDate,
                        @Param("endDate") java.sql.Timestamp endDate);

        /**
         * Returns the highest PERCENTAGE_PACKAGE_SESSION_COMPLETED value across all
         * package_sessions of the given course for the given user. If the learner
         * has no learner_operation rows for this course (e.g., not enrolled or
         * never started), returns NULL.
         *
         * MAX is used (not SUM) so multi-enrollment learners see their best progress
         * for the course, capped naturally at 100.
         */
        @Query(value = """
                        SELECT MAX(CAST(lo.value AS DOUBLE PRECISION))
                        FROM learner_operation lo
                        JOIN package_session ps ON ps.id = lo.source_id
                        WHERE ps.package_id = :courseId
                          AND lo.user_id = :userId
                          AND lo.source = 'PACKAGE_SESSION'
                          AND lo.operation = 'PERCENTAGE_PACKAGE_SESSION_COMPLETED'
                          AND lo.value ~ '^-?\\d+(\\.\\d+)?$'
                        """, nativeQuery = true)
        Double findMaxCoursePercentageForUser(
                        @Param("courseId") String courseId,
                        @Param("userId") String userId);

        /** One slide-level progress row (operation → raw value) for the overlay queries below. */
        interface SlideOperationRow {
                String getSourceId();

                String getOperation();

                String getValue();
        }

        /** Slide-derived completion percentage for one chapter. */
        interface ChapterProgressRow {
                String getChapterId();

                Double getPercentageCompleted();
        }

        /** LAST_SLIDE_VIEWED value for one chapter. */
        interface ChapterLastSlideRow {
                String getChapterId();

                String getLastSlideViewed();
        }

        /**
         * The user's slide-level progress rows for every chapter of a package
         * session. Overlaid onto the cached (user-independent) slides structure
         * by LearnerStudyLibraryService. Ordered by updated_at so that when
         * legacy duplicate rows exist, the newest wins in the caller's map.
         */
        @Query(value = """
                        SELECT lo.source_id AS "sourceId", lo.operation AS "operation", lo.value AS "value"
                        FROM learner_operation lo
                        WHERE lo.user_id = :userId
                          AND lo.source = 'SLIDE'
                          AND lo.operation IN (:operations)
                          AND lo.source_id IN (
                              SELECT cs.slide_id
                              FROM chapter_to_slides cs
                              JOIN chapter_package_session_mapping cpsm ON cpsm.chapter_id = cs.chapter_id
                              WHERE cpsm.package_session_id = :packageSessionId AND cpsm.status = 'ACTIVE'
                          )
                        ORDER BY lo.updated_at ASC
                        """, nativeQuery = true)
        java.util.List<SlideOperationRow> findSlideOperationsForPackageSession(
                        @Param("userId") String userId,
                        @Param("packageSessionId") String packageSessionId,
                        @Param("operations") java.util.List<String> operations);

        /**
         * Per-chapter completion % for the user, derived from slide-level
         * operations exactly like the chapter_slide_pct subquery inside
         * ModuleChapterMappingRepository.getModuleChapterProgress — average
         * over the chapter's slides of the best percentage op, capped at 100,
         * slides without progress counting as 0.
         *
         * A chapter appears here only if it has at least one learner-visible
         * slide; an untouched slide still scores 0, so a chapter that has slides
         * always produces a row. Callers rely on that: a missing chapter id means
         * "nothing in it to complete", not "the learner scored zero".
         */
        @Query(value = """
                        SELECT sub.chapter_id AS "chapterId", AVG(sub.slide_pct) AS "percentageCompleted"
                        FROM (
                            SELECT cts.chapter_id, s.id,
                                -- Must list EVERY slide-level completion operation. A type
                                -- missing here scores its slides 0 forever and silently caps
                                -- the chapter, module and subject the learner sees.
                                COALESCE(MAX(CASE
                                    WHEN lo.operation IN (
                                            'PERCENTAGE_VIDEO_WATCHED', 'PERCENTAGE_DOCUMENT_COMPLETED',
                                            'PERCENTAGE_QUIZ_COMPLETED', 'PERCENTAGE_QUESTION_COMPLETED',
                                            'PERCENTAGE_ASSIGNMENT_COMPLETED', 'PERCENTAGE_AUDIO_LISTENED',
                                            'PERCENTAGE_SCORM_COMPLETED', 'PERCENTAGE_ASSESSMENT_DONE')
                                         AND lo.value ~ '^[0-9]+(\\.[0-9]+)?$'
                                    THEN LEAST(CAST(lo.value AS FLOAT), 100)
                                    ELSE NULL
                                END), 0) AS slide_pct
                            FROM chapter_to_slides cts
                            JOIN slide s ON s.id = cts.slide_id AND s.status IN (:slideStatusList)
                            LEFT JOIN learner_operation lo
                                ON lo.source_id = s.id AND lo.source = 'SLIDE' AND lo.user_id = :userId
                            WHERE cts.status IN (:chapterToSlideStatusList)
                              AND cts.chapter_id IN (
                                  SELECT cpsm.chapter_id FROM chapter_package_session_mapping cpsm
                                  WHERE cpsm.package_session_id = :packageSessionId AND cpsm.status = 'ACTIVE'
                              )
                            GROUP BY cts.chapter_id, s.id
                        ) sub
                        GROUP BY sub.chapter_id
                        """, nativeQuery = true)
        java.util.List<ChapterProgressRow> findChapterSlideProgressForPackageSession(
                        @Param("userId") String userId,
                        @Param("packageSessionId") String packageSessionId,
                        @Param("slideStatusList") java.util.List<String> slideStatusList,
                        @Param("chapterToSlideStatusList") java.util.List<String> chapterToSlideStatusList);

        /** The user's LAST_SLIDE_VIEWED per chapter of the package session. */
        @Query(value = """
                        SELECT lo.source_id AS "chapterId", MAX(lo.value) AS "lastSlideViewed"
                        FROM learner_operation lo
                        WHERE lo.user_id = :userId
                          AND lo.source = 'CHAPTER'
                          AND lo.operation = 'LAST_SLIDE_VIEWED'
                          AND lo.source_id IN (
                              SELECT cpsm.chapter_id FROM chapter_package_session_mapping cpsm
                              WHERE cpsm.package_session_id = :packageSessionId AND cpsm.status = 'ACTIVE'
                          )
                        GROUP BY lo.source_id
                        """, nativeQuery = true)
        java.util.List<ChapterLastSlideRow> findChapterLastSlideViewedForPackageSession(
                        @Param("userId") String userId,
                        @Param("packageSessionId") String packageSessionId);
}
