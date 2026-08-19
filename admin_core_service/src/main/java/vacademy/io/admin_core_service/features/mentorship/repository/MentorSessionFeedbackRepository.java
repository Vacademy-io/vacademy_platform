package vacademy.io.admin_core_service.features.mentorship.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorSessionFeedback;

import java.util.List;
import java.util.Optional;

@Repository
public interface MentorSessionFeedbackRepository extends JpaRepository<MentorSessionFeedback, String> {

    Optional<MentorSessionFeedback> findByBookingInstanceIdAndStudentUserId(
            String bookingInstanceId, String studentUserId);

    /** Ratings for a set of sessions — decorates a page of the admin session list in one query. */
    List<MentorSessionFeedback> findByBookingInstanceIdIn(List<String> bookingInstanceIds);

    /** The learner's own ratings — used to hide sessions they've already rated. */
    List<MentorSessionFeedback> findByInstituteIdAndStudentUserId(String instituteId, String studentUserId);

    /** One mentor's ratings, newest first, for the admin detail view. */
    List<MentorSessionFeedback> findByInstituteIdAndMentorIdOrderByCreatedAtDesc(
            String instituteId, String mentorId);

    /**
     * Per-mentor rating aggregate for the whole institute in one query — the mentor
     * list would otherwise need a count+avg round trip per row.
     * Returns rows of [mentorId, avgRating, ratingCount].
     */
    @Query("""
            SELECT f.mentorId, AVG(f.rating), COUNT(f)
            FROM MentorSessionFeedback f
            WHERE f.instituteId = :instituteId
            GROUP BY f.mentorId
            """)
    List<Object[]> aggregateByMentor(@Param("instituteId") String instituteId);
}
