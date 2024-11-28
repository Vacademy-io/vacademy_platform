package vacademy.io.common.auth.repository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRoleRepository extends CrudRepository<UserRole, String> {

    List<UserRole> findByUser(User user);

}