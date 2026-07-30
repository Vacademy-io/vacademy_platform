package vacademy.io.auth_service.feature.demo.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.auth_service.feature.demo.entity.InstituteTrial;

import java.util.List;

public interface InstituteTrialRepository extends JpaRepository<InstituteTrial, String> {
    List<InstituteTrial> findByInstituteIdIn(List<String> instituteIds);
}
