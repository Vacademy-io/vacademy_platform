package vacademy.io.community_service.feature.init.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.init.entity.Levels;

@Repository
public interface LevelsRepository extends JpaRepository<Levels, String> {
}
