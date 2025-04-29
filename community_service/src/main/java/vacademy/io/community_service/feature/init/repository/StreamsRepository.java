package vacademy.io.community_service.feature.init.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.init.entity.Streams;

@Repository
public interface StreamsRepository extends JpaRepository<Streams, String> {
}
