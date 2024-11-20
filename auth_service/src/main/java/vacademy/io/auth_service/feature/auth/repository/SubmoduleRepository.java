package vacademy.io.auth_service.feature.auth.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.auth_service.feature.auth.entity.Submodule;
import vacademy.io.common.auth.dto.SubmoduleDTO;

import java.util.List;


@Repository
public interface SubmoduleRepository extends CrudRepository<Submodule, String> {

    @Query(value = "SELECT new vacademy.io.common.auth.dto.SubmoduleDTO(s.submoduleName, m.moduleName) " +
            "FROM Submodule s " +
            "JOIN Module m ON s.moduleId = m.id " +
            "WHERE s.id IN :submoduleIds")
    List<SubmoduleDTO> findSubmoduleDetailsByIds(@Param("submoduleIds") List<String> submoduleIds);
}
