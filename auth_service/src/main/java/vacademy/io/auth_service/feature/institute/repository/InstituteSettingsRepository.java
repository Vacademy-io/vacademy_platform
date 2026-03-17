package vacademy.io.auth_service.feature.institute.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.auth_service.feature.institute.entity.InstituteSettings;

import java.util.Optional;

@Repository
public interface InstituteSettingsRepository extends JpaRepository<InstituteSettings, String> {
    Optional<InstituteSettings> findByInstituteId(String instituteId);
}
