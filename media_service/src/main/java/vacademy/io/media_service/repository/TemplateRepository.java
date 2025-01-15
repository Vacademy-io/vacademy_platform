package vacademy.io.media_service.repository;

import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.media_service.entity.Template;

@Repository
public interface TemplateRepository extends CrudRepository<Template, String> {
}