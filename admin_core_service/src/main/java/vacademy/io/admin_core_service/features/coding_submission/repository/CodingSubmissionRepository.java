package vacademy.io.admin_core_service.features.coding_submission.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.coding_submission.entity.CodingSubmission;

@Repository
public interface CodingSubmissionRepository
        extends JpaRepository<CodingSubmission, String> {

    Page<CodingSubmission> findBySlideIdOrderBySubmittedAtDesc(
            String slideId, Pageable pageable);

    Page<CodingSubmission> findBySlideIdAndLearnerIdOrderBySubmittedAtDesc(
            String slideId, String learnerId, Pageable pageable);

    Page<CodingSubmission> findByLearnerIdOrderBySubmittedAtDesc(
            String learnerId, Pageable pageable);
}
