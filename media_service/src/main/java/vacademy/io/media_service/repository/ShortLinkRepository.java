package vacademy.io.media_service.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.media_service.entity.ShortLink;

import java.util.Optional;

@Repository
public interface ShortLinkRepository extends JpaRepository<ShortLink, String> {
    Optional<ShortLink> findByShortName(String shortName);

    Optional<ShortLink> findBySourceAndSourceId(String source, String sourceId);
}
