package vacademy.io.admin_core_service.features.payments.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.payments.entity.WebHook;

public interface WebHookRepository extends JpaRepository<WebHook, String> {
}
