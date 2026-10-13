package vacademy.io.auth_service.feature.login_link.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.auth_service.feature.login_link.entity.LearnerLoginCode;

import java.time.Instant;
import java.util.Optional;

public interface LearnerLoginCodeRepository extends JpaRepository<LearnerLoginCode, String> {

    Optional<LearnerLoginCode> findByCodeHash(String codeHash);

    @Modifying
    @Transactional
    @Query("UPDATE LearnerLoginCode c SET c.useCount = c.useCount + 1, c.lastUsedAt = :now, c.lastUsedIp = :ip WHERE c.id = :id")
    int recordUse(@Param("id") String id, @Param("now") Instant now, @Param("ip") String ip);
}
