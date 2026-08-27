package vacademy.io.admin_core_service.features.mentorship.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorSessionRecord;

import java.util.List;
import java.util.Optional;

@Repository
public interface MentorSessionRecordRepository extends JpaRepository<MentorSessionRecord, String> {

    Optional<MentorSessionRecord> findByBookingInstanceId(String bookingInstanceId);

    /** Records for a set of sessions — used to decorate a page of the admin session list. */
    List<MentorSessionRecord> findByBookingInstanceIdIn(List<String> bookingInstanceIds);

    long countByInstituteIdAndOutcome(String instituteId, String outcome);

    long countByMentorIdAndOutcome(String mentorId, String outcome);

    List<MentorSessionRecord> findByInstituteIdAndStudentUserIdOrderByMarkedAtDesc(
            String instituteId, String studentUserId);
}
