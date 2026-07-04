package vacademy.io.admin_core_service.features.learner_tracking.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.learner_tracking.dto.SlideMarksProjection;
import vacademy.io.admin_core_service.features.learner_tracking.entity.QuestionSlideTracked;

import java.sql.Timestamp;
import java.util.List;

public interface QuestionSlideTrackedRepository extends JpaRepository<QuestionSlideTracked, String> {
    @Modifying
    @Transactional
    @Query("DELETE FROM VideoTracked v WHERE v.activityLog.id = :activityId")
    void deleteByActivityId(@Param("activityId") String activityId);

    /**
     * Student report v2 "Marks by Subject": per-slide QUESTION marks for a user in a date range.
     * Dated by {@code question_slide_tracked.created_at} (the attempt itself), NOT the parent
     * activity_log's created_at — same lesson as {@code AssignmentSlideTrackedRepository}.
     *
     * <p>Assumption: multiple attempts on the same slide → MAX(marks) is taken as the learner's
     * mark for that slide. Total marks = question_slide.points. Subject is resolved via the
     * standard slide→chapter→module→subject join; a slide mapped to multiple subjects is
     * collapsed to one (DISTINCT ON) to avoid fan-out duplication.
     */
    @Query(value = """
            WITH question_marks AS (
                SELECT al.slide_id AS slide_id, MAX(qst.marks) AS marks_obtained
                FROM question_slide_tracked qst
                JOIN activity_log al ON al.id = qst.activity_id
                WHERE al.user_id = :userId
                  AND al.source_type = 'QUESTION'
                  AND qst.created_at BETWEEN :start AND :end
                GROUP BY al.slide_id
            ),
            slide_info AS (
                SELECT DISTINCT ON (s.id)
                    s.id AS slide_id, s.title AS title, s.source_id AS source_id,
                    sub.subject_name AS subject_name
                FROM slide s
                LEFT JOIN chapter_to_slides cs ON cs.slide_id = s.id
                LEFT JOIN chapter c ON c.id = cs.chapter_id
                LEFT JOIN module_chapter_mapping mcm ON mcm.chapter_id = c.id
                LEFT JOIN modules m ON m.id = mcm.module_id
                LEFT JOIN subject_module_mapping smm ON smm.module_id = m.id
                LEFT JOIN subject sub ON sub.id = smm.subject_id
                WHERE s.id IN (SELECT slide_id FROM question_marks)
                ORDER BY s.id, cs.created_at ASC NULLS LAST
            )
            SELECT
                qm.slide_id AS slideId,
                si.title AS title,
                si.subject_name AS subjectName,
                qm.marks_obtained AS marksObtained,
                qs.points::float8 AS totalMarks
            FROM question_marks qm
            JOIN slide_info si ON si.slide_id = qm.slide_id
            LEFT JOIN question_slide qs ON qs.id = si.source_id
            """, nativeQuery = true)
    List<SlideMarksProjection> findQuestionMarksForUserInRange(
            @Param("userId") String userId,
            @Param("start") Timestamp start,
            @Param("end") Timestamp end);
}
