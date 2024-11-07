package vacademy.io.auth_service.feature.auth.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.auth_service.feature.auth.entity.ClientCredential;

@Repository
public interface ClientAuthenticationRepository extends CrudRepository<ClientCredential, String> {

    @Query(value="SELECT COUNT(*) > 0 FROM client_credentials WHERE client_name = :clientName AND token = :clientToken", nativeQuery = true)
    boolean validateClient(@Param("clientName") String clientName, @Param("clientToken") String clientToken);
}
