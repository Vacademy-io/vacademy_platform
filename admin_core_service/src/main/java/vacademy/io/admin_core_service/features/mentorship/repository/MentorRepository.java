package vacademy.io.admin_core_service.features.mentorship.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.mentorship.entity.Mentor;

import java.util.List;
import java.util.Optional;

@Repository
public interface MentorRepository extends JpaRepository<Mentor, String> {

    List<Mentor> findByInstituteIdAndStatusNot(String instituteId, String excludedStatus);

    Page<Mentor> findByInstituteIdAndStatusNot(String instituteId, String excludedStatus, Pageable pageable);

    Optional<Mentor> findByInstituteIdAndUserIdAndStatusNot(String instituteId, String userId, String excludedStatus);

    Optional<Mentor> findByIdAndInstituteIdAndStatusNot(String id, String instituteId, String excludedStatus);

    List<Mentor> findByInstituteIdAndUserIdInAndStatusNot(String instituteId, List<String> userIds, String excludedStatus);
}
