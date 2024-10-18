package labor.link.media_service.repository;

import labor.link.media_service.entity.Template;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TemplateRepository extends CrudRepository<Template, String> {
}