package vacademy.io.admin_core_service.features.mentorship.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorRequest;

import java.util.List;
import java.util.Optional;

@Repository
public interface MentorRequestRepository extends JpaRepository<MentorRequest, String> {

    Page<MentorRequest> findByInstituteIdAndStatusOrderByCreatedAtDesc(
            String instituteId, String status, Pageable pageable);

    List<MentorRequest> findByInstituteIdAndStudentUserIdOrderByCreatedAtDesc(
            String instituteId, String studentUserId);

    /** The learner's live request for a specific mentor (duplicate guard). */
    Optional<MentorRequest> findByInstituteIdAndStudentUserIdAndMentorIdAndStatus(
            String instituteId, String studentUserId, String mentorId, String status);

    /** The learner's live open-ended ("any mentor") request. */
    Optional<MentorRequest> findByInstituteIdAndStudentUserIdAndMentorIdIsNullAndStatus(
            String instituteId, String studentUserId, String status);

    Optional<MentorRequest> findByIdAndInstituteId(String id, String instituteId);

    /** Live requests aimed at one mentor — used to clear the queue when a mentor is removed. */
    List<MentorRequest> findByMentorIdAndStatus(String mentorId, String status);

    long countByInstituteIdAndStatus(String instituteId, String status);
}
