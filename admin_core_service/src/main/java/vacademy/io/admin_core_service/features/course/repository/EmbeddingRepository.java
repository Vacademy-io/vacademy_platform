package vacademy.io.admin_core_service.features.course.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.course.entity.Embedding;


@Repository
public interface EmbeddingRepository extends JpaRepository<Embedding, String> {

}
