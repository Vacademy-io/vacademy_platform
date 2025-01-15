package vacademy.io.common.auth.repository;

import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.common.auth.entity.UserActivity;

@Repository
public interface UserActivityRepository extends CrudRepository<UserActivity, String> {

}