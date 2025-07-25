package vacademy.io.common.auth.repository;

import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.common.auth.entity.RefreshToken;
import vacademy.io.common.auth.entity.User;

import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends CrudRepository<RefreshToken, String> {

    Optional<RefreshToken> findByToken(String token);

    void deleteAllByUserInfo(User user);

    Optional<RefreshToken> findByUserInfo(User user);
}