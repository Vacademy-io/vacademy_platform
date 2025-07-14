package vacademy.io.media_service.course.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.media_service.course.entity.Embedding;


@Repository
public interface EmbeddingRepository extends JpaRepository<vacademy.io.media_service.course.entity.Embedding, String> {

}
