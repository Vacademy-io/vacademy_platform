package vacademy.io.admin_core_service.features.course_catalogue.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.course_catalogue.entity.CatalogueInstituteMapping;
import vacademy.io.admin_core_service.features.course_catalogue.entity.CourseCatalogue;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseCatalogueRepository extends JpaRepository<CourseCatalogue, String> {

    /** Serializes revision writers per catalogue (draft save/publish/discard). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CourseCatalogue c where c.id = :id")
    Optional<CourseCatalogue> findByIdForUpdate(@Param("id") String id);
}
