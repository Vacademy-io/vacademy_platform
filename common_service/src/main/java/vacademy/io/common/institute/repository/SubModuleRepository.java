package vacademy.io.common.institute.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.common.institute.entity.module.Submodule;

import java.util.List;

@Repository
public interface SubModuleRepository extends JpaRepository<Submodule, String> {
    @Query(value = """
            SELECT sm.* FROM sub_modules sm
            WHERE (:ids IS NULL OR sm.id IN (:ids))
            """, nativeQuery = true)
    List<Submodule> findAllById(@Param("ids") List<String> ids);
}
