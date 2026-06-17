package vacademy.io.community_service.feature.support.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.support.entity.SupportGlobalSettings;

@Repository
public interface SupportGlobalSettingsRepository extends JpaRepository<SupportGlobalSettings, String> {
}
