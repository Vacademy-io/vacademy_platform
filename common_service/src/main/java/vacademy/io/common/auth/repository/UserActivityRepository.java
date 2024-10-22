package vacademy.io.common.auth.repository;

import vacademy.io.common.auth.entity.UserActivity;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserActivityRepository extends CrudRepository<UserActivity, String> {

}