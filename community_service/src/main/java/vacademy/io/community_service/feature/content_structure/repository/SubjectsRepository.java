package vacademy.io.community_service.feature.content_structure.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.content_structure.entity.Subjects;

@Repository
public interface SubjectsRepository extends JpaRepository<Subjects, String> {

}
