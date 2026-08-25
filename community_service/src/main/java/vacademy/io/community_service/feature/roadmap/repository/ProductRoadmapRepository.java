package vacademy.io.community_service.feature.roadmap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.community_service.feature.roadmap.entity.ProductRoadmap;

import java.util.Date;
import java.util.Optional;

public interface ProductRoadmapRepository extends JpaRepository<ProductRoadmap, String> {

    /**
     * Reads the timestamp without loading html_content. The admin dock polls this on
     * every page load purely to decide whether to show a "new" dot, and the roadmap
     * body is ~1MB -- selecting the entity would pull all of it into memory to throw
     * it away.
     */
    @Query("SELECT r.updatedAt FROM ProductRoadmap r WHERE r.id = :id")
    Optional<Date> findUpdatedAtById(@Param("id") String id);
}
