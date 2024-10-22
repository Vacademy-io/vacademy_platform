package vacademy.io.common.auth.repository;

import vacademy.io.common.auth.entity.User;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends CrudRepository<User, String> {
    Optional<User> findByUsername(String username);

    List<User> findByIdIn(List<String> userIds);
}