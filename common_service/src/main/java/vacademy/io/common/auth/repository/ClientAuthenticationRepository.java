package vacademy.io.common.auth.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.common.auth.entity.ClientSecretKey;

@Repository
public interface ClientAuthenticationRepository extends CrudRepository<ClientSecretKey, String> {

    @Query(value = "SELECT COUNT(*) > 0 FROM client_secret_key WHERE client_name = :clientName AND secret_key = :clientToken", nativeQuery = true)
    boolean validateClient(@Param("clientName") String clientName, @Param("clientToken") String clientToken);
}
