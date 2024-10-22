package vacademy.io.common.auth.repository;

import vacademy.io.common.auth.entity.RefreshToken;
import vacademy.io.common.auth.entity.User;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends CrudRepository<RefreshToken, String> {

    Optional<RefreshToken> findByToken(String token);

    void deleteAllByUserInfo(User user);
}