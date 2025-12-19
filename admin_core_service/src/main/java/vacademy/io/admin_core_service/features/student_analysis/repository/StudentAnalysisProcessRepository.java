package vacademy.io.admin_core_service.features.student_analysis.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.student_analysis.entity.StudentAnalysisProcess;

import java.util.Optional;

public interface StudentAnalysisProcessRepository extends JpaRepository<StudentAnalysisProcess, String> {

        /**
         * Find process by ID
         */
        Optional<StudentAnalysisProcess> findById(String id);

        /**
         * Find all completed reports for a user with pagination
         */
        Page<StudentAnalysisProcess> findByUserIdAndStatusOrderByCreatedAtDesc(String userId, String status,
                        Pageable pageable);
}
