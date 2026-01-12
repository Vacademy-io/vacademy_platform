package vacademy.io.admin_core_service.features.template.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.template.entity.Template;

@Repository
public interface WhatsAppTemplateRepository extends JpaRepository<Template, String> {
    // Additional custom query methods can be added here if needed
}
