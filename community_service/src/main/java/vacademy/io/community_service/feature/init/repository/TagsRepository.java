package vacademy.io.community_service.feature.init.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.init.entity.Tags;

import java.util.List;
import java.util.Optional;
import java.util.Set;

@Repository
public interface TagsRepository extends JpaRepository<Tags , String> {
    Optional<Tags> findByTagName(String tagName);

    List<Tags> findAllByTagNameIn(Set<String> tagNames);
}

