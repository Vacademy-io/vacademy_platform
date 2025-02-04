package vacademy.io.assessment_service.features.learner_assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.assessment_service.features.annoucement.entity.AssessmentAnnouncement;

import java.util.Date;
import java.util.List;

@Repository
public interface AssessmentAnnouncementRepository extends JpaRepository<AssessmentAnnouncement, String> {

    List<AssessmentAnnouncement> findByAssessmentId(String assessmentId);

    @Query(value = """
            SELECT aa.* FROM assessment_announcement AS aa
            WHERE aa.assessment_id = :assessmentId
            AND aa.sent_time > :lastFetchedTime
            """, nativeQuery = true)
    List<AssessmentAnnouncement> findByAssessmentIdAndSentTimeAfterAndStatusNotIn(@Param("assessmentId") String assessmentId,
                                                                                  @Param("lastFetchedTime") Date lastFetchedTime);
}
