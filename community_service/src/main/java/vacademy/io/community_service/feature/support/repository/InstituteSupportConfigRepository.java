package vacademy.io.community_service.feature.support.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.support.entity.InstituteSupportConfig;

import java.util.Optional;

@Repository
public interface InstituteSupportConfigRepository extends JpaRepository<InstituteSupportConfig, String> {

    Optional<InstituteSupportConfig> findByInstituteId(String instituteId);
}
