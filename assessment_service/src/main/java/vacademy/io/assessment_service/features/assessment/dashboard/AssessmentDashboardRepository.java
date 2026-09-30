package vacademy.io.assessment_service.features.assessment.dashboard;

import java.util.List;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import vacademy.io.assessment_service.features.assessment.entity.Assessment;

/**
 * Read-only aggregates behind the Assessments Overview tab. Every method is one
 * native query over the institute's assessments; the caller stitches the parts
 * into {@link AssessmentDashboardDto}. Batch names are not known here (they live
 * in admin_core_service) - only ids are returned and the dashboard maps them.
 * Batch scoping: allBatches = true ignores batchIds (which must still be a
 * non-empty list, the caller passes a placeholder) - a null collection cannot be
 * bound into IN (...) by Hibernate.
 *
 * NB no apostrophes or colons inside SQL comments - Spring Data scans the raw
 * string for quotes and parameters and cannot see SQL comments.
 */
public interface AssessmentDashboardRepository extends Repository<Assessment, String> {

        interface ParticipationRow {
                Long getRegisteredLearners();
                Long getAttemptedLearners();
                Long getAttemptsTotal();
                Long getAttemptsLast7Days();
                Long getLiveAttempts();
        }

        interface PendingRow {
                Long getManualEvaluationPending();
                Long getAiChecksRunning();
                Long getAiChecksFailed();
                Long getResultsToRelease();
                Long getReattemptRequestsPending();
        }

        interface BatchRow {
                String getBatchId();
                Long getAssessments();
                Long getLearners();
                Long getAttempts();
                Double getAvgPercent();
                Double getBestPercent();
                Double getLowestPercent();
        }

        interface AssessmentRow {
                String getAssessmentId();
                String getName();
                String getPlayMode();
                String getVisibility();
                String getEvaluationType();
                java.util.Date getStartTime();
                java.util.Date getEndTime();
                Long getParticipants();
                Long getAttempted();
                Double getAvgPercent();
                Long getPendingEvaluation();
                Long getToRelease();
        }

        @Query(value = """
                        SELECT
                            COUNT(DISTINCT aur.user_id) AS registeredLearners,
                            COUNT(DISTINCT CASE WHEN sa.status = 'ENDED' THEN aur.user_id END) AS attemptedLearners,
                            COUNT(sa.id) AS attemptsTotal,
                            COUNT(CASE WHEN sa.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) AS attemptsLast7Days,
                            COUNT(CASE WHEN sa.status = 'LIVE' THEN 1 END) AS liveAttempts
                        FROM assessment_user_registration aur
                        JOIN assessment_institute_mapping aim ON aim.assessment_id = aur.assessment_id
                        LEFT JOIN student_attempt sa ON sa.registration_id = aur.id
                        WHERE aim.institute_id = :instituteId
                          AND (:allBatches = TRUE OR aur.source_id IN (:batchIds))
                        """, nativeQuery = true)
        ParticipationRow participation(@Param("instituteId") String instituteId,
                        @Param("allBatches") boolean allBatches, @Param("batchIds") List<String> batchIds);

        @Query(value = """
                        SELECT
                            COUNT(CASE WHEN sa.status = 'ENDED' AND a.evaluation_type = 'MANUAL'
                                        AND (sa.result_status IS NULL OR sa.result_status <> 'COMPLETED') THEN 1 END) AS manualEvaluationPending,
                            (SELECT COUNT(*) FROM ai_evaluation_process p
                               JOIN assessment_institute_mapping m2 ON m2.assessment_id = p.assessment_id
                              WHERE m2.institute_id = :instituteId
                                AND p.status IN ('PENDING','STARTED','PROCESSING','EXTRACTING','EVALUATING')) AS aiChecksRunning,
                            (SELECT COUNT(*) FROM ai_evaluation_process p
                               JOIN assessment_institute_mapping m2 ON m2.assessment_id = p.assessment_id
                              WHERE m2.institute_id = :instituteId AND p.status = 'FAILED'
                                AND p.created_at >= NOW() - INTERVAL '30 days') AS aiChecksFailed,
                            COUNT(CASE WHEN sa.status = 'ENDED' AND a.result_type = 'MANUAL'
                                        AND sa.report_release_status = 'PENDING' THEN 1 END) AS resultsToRelease,
                            (SELECT COUNT(*) FROM assessment_reattempt_request r
                              WHERE r.institute_id = :instituteId AND r.status = 'PENDING') AS reattemptRequestsPending
                        FROM student_attempt sa
                        JOIN assessment_user_registration aur ON aur.id = sa.registration_id
                        JOIN assessment a ON a.id = aur.assessment_id
                        JOIN assessment_institute_mapping aim ON aim.assessment_id = a.id
                        WHERE aim.institute_id = :instituteId
                          AND (:allBatches = TRUE OR aur.source_id IN (:batchIds))
                        """, nativeQuery = true)
        PendingRow pending(@Param("instituteId") String instituteId,
                        @Param("allBatches") boolean allBatches, @Param("batchIds") List<String> batchIds);

        /**
         * Latest ENDED attempt per registration, scored against the sum of the
         * assessment sections' total marks; grouped by the registering batch.
         */
        @Query(value = """
                        WITH max_marks AS (
                            SELECT s.assessment_id, SUM(s.total_marks) AS total
                            FROM section s
                            WHERE s.status IS NULL OR s.status <> 'DELETED'
                            GROUP BY s.assessment_id
                        ),
                        latest AS (
                            SELECT sa.registration_id, sa.total_marks,
                                   ROW_NUMBER() OVER (PARTITION BY sa.registration_id ORDER BY sa.created_at DESC) AS rn
                            FROM student_attempt sa
                            WHERE sa.status = 'ENDED'
                        )
                        SELECT
                            aur.source_id AS batchId,
                            COUNT(DISTINCT aur.assessment_id) AS assessments,
                            COUNT(DISTINCT aur.user_id) AS learners,
                            COUNT(l.registration_id) AS attempts,
                            AVG(CASE WHEN mm.total > 0 THEN LEAST(100.0, GREATEST(0.0, l.total_marks * 100.0 / mm.total)) END) AS avgPercent,
                            MAX(CASE WHEN mm.total > 0 THEN LEAST(100.0, GREATEST(0.0, l.total_marks * 100.0 / mm.total)) END) AS bestPercent,
                            MIN(CASE WHEN mm.total > 0 THEN LEAST(100.0, GREATEST(0.0, l.total_marks * 100.0 / mm.total)) END) AS lowestPercent
                        FROM assessment_user_registration aur
                        JOIN assessment_institute_mapping aim ON aim.assessment_id = aur.assessment_id
                        JOIN assessment a ON a.id = aur.assessment_id AND a.status = 'PUBLISHED'
                        LEFT JOIN latest l ON l.registration_id = aur.id AND l.rn = 1
                        LEFT JOIN max_marks mm ON mm.assessment_id = aur.assessment_id
                        WHERE aim.institute_id = :instituteId
                          AND aur.source IN ('BATCH_PREVIEW_REGISTRATION', 'BATCH')
                          AND aur.source_id IS NOT NULL
                          AND (:allBatches = TRUE OR aur.source_id IN (:batchIds))
                        GROUP BY aur.source_id
                        ORDER BY attempts DESC
                        LIMIT 50
                        """, nativeQuery = true)
        List<BatchRow> batchPerformance(@Param("instituteId") String instituteId,
                        @Param("allBatches") boolean allBatches, @Param("batchIds") List<String> batchIds);

        /** The most recent published assessments with how they went, newest first. */
        @Query(value = """
                        WITH max_marks AS (
                            SELECT s.assessment_id, SUM(s.total_marks) AS total
                            FROM section s
                            WHERE s.status IS NULL OR s.status <> 'DELETED'
                            GROUP BY s.assessment_id
                        ),
                        latest AS (
                            SELECT sa.registration_id, sa.total_marks, sa.status, sa.result_status, sa.report_release_status,
                                   ROW_NUMBER() OVER (PARTITION BY sa.registration_id ORDER BY sa.created_at DESC) AS rn
                            FROM student_attempt sa
                        )
                        SELECT
                            a.id AS assessmentId,
                            a.name AS name,
                            a.play_mode AS playMode,
                            a.assessment_visibility AS visibility,
                            a.evaluation_type AS evaluationType,
                            a.bound_start_time AS startTime,
                            a.bound_end_time AS endTime,
                            COUNT(DISTINCT aur.user_id) AS participants,
                            COUNT(CASE WHEN l.status = 'ENDED' THEN 1 END) AS attempted,
                            AVG(CASE WHEN l.status = 'ENDED' AND mm.total > 0 THEN LEAST(100.0, GREATEST(0.0, l.total_marks * 100.0 / mm.total)) END) AS avgPercent,
                            COUNT(CASE WHEN l.status = 'ENDED' AND a.evaluation_type = 'MANUAL'
                                        AND (l.result_status IS NULL OR l.result_status <> 'COMPLETED') THEN 1 END) AS pendingEvaluation,
                            COUNT(CASE WHEN l.status = 'ENDED' AND a.result_type = 'MANUAL'
                                        AND l.report_release_status = 'PENDING' THEN 1 END) AS toRelease
                        FROM assessment a
                        JOIN assessment_institute_mapping aim ON aim.assessment_id = a.id
                        LEFT JOIN assessment_user_registration aur ON aur.assessment_id = a.id
                             AND (:allBatches = TRUE OR aur.source_id IN (:batchIds))
                        LEFT JOIN latest l ON l.registration_id = aur.id AND l.rn = 1
                        LEFT JOIN max_marks mm ON mm.assessment_id = a.id
                        WHERE aim.institute_id = :instituteId
                          AND a.status = 'PUBLISHED'
                        GROUP BY a.id, a.name, a.play_mode, a.assessment_visibility, a.evaluation_type, a.bound_start_time, a.bound_end_time, a.created_at
                        ORDER BY a.created_at DESC
                        LIMIT :limit
                        """, nativeQuery = true)
        List<AssessmentRow> recentAssessments(@Param("instituteId") String instituteId,
                        @Param("allBatches") boolean allBatches, @Param("batchIds") List<String> batchIds,
                        @Param("limit") int limit);
}
