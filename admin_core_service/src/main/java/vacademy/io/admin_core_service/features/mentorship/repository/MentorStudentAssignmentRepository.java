package vacademy.io.admin_core_service.features.mentorship.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorStudentAssignment;

import java.util.List;
import java.util.Optional;

@Repository
public interface MentorStudentAssignmentRepository extends JpaRepository<MentorStudentAssignment, String> {

    List<MentorStudentAssignment> findByInstituteIdAndStatus(String instituteId, String status);

    List<MentorStudentAssignment> findByInstituteIdAndStudentUserIdAndStatus(String instituteId, String studentUserId, String status);

    List<MentorStudentAssignment> findByInstituteIdAndMentorUserIdAndStatus(String instituteId, String mentorUserId, String status);

    List<MentorStudentAssignment> findByMentorIdAndStatus(String mentorId, String status);

    long countByMentorIdAndStatus(String mentorId, String status);

    Optional<MentorStudentAssignment> findByInstituteIdAndMentorIdAndStudentUserIdAndStatus(
            String instituteId, String mentorId, String studentUserId, String status);

    Optional<MentorStudentAssignment> findByIdAndInstituteId(String id, String instituteId);
}
