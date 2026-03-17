package vacademy.io.common.auth.repository;

import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.common.auth.entity.Role;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoleRepository extends CrudRepository<Role, String> {
    Optional<Role> findByName(String name);

    List<Role> findByNameIn(List<String> names);

    List<Role> findAllByInstituteId(String instituteId);

    Optional<Role> findByNameAndInstituteId(String name, String instituteId);

}