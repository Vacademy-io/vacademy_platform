package vacademy.io.admin_core_service.features.live_session.provider.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.provider.entity.AppConfig;

import java.util.Optional;

@Repository
public interface AppConfigRepository extends JpaRepository<AppConfig, String> {

    Optional<AppConfig> findByConfigKey(String configKey);

    default int getIntConfig(String key, int defaultValue) {
        return findByConfigKey(key)
                .map(c -> c.getIntValue(defaultValue))
                .orElse(defaultValue);
    }
}
