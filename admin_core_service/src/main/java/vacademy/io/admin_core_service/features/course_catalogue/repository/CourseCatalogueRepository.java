package vacademy.io.admin_core_service.features.course_catalogue.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.course_catalogue.entity.CatalogueInstituteMapping;
import vacademy.io.admin_core_service.features.course_catalogue.entity.CourseCatalogue;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseCatalogueRepository extends JpaRepository<CourseCatalogue, String> {

}
