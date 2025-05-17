package vacademy.io.admin_core_service.features.faculty.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.faculty.entity.FacultySubjectPackageSessionMapping;

import java.util.List;

public interface FacultySubjectPackageSessionMappingRepository extends JpaRepository<FacultySubjectPackageSessionMapping,String> {

    @Query(value = """
    SELECT DISTINCT ON (fm.user_id) fm.*
    FROM faculty_subject_package_session_mapping fm
    WHERE (:subjectIds IS NULL OR fm.subject_id IN (:subjectIds))
      AND (:batchesIds IS NULL OR fm.package_session_id IN (:batchesIds))
      AND (:statusList IS NULL OR fm.status IN (:statusList))
      AND (:name IS NULL OR :name = '' OR LOWER(fm.name) LIKE LOWER(CONCAT('%', :name, '%')))
    ORDER BY fm.user_id, fm.updated_at DESC
    """,
            countQuery = """
    SELECT COUNT(DISTINCT fm.user_id)
    FROM faculty_subject_package_session_mapping fm
    WHERE (:subjectIds IS NULL OR fm.subject_id IN (:subjectIds))
      AND (:batchesIds IS NULL OR fm.package_session_id IN (:batchesIds))
      AND (:statusList IS NULL OR fm.status IN (:statusList))
      AND (:name IS NULL OR :name = '' OR LOWER(fm.name) LIKE LOWER(CONCAT('%', :name, '%')))
    """,
            nativeQuery = true)
    Page<FacultySubjectPackageSessionMapping> findByFilters(
            @Param("name") String name,
            @Param("subjectIds") List<String> subjects,
            @Param("batchesIds") List<String> batches,
            @Param("statusList") List<String> status,
            Pageable pageable);

//WHERE (:name IS NULL OR :name = '' OR LOWER(a.name) LIKE LOWER(CONCAT('%', :name, '%')))
}
