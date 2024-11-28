package vacademy.io.common.core.internal_api_wrapper.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.common.auth.entity.ClientSecretKey;

@Repository
public interface ClientSecretRepository extends JpaRepository<ClientSecretKey, String> {

    // Define a method to find the secret key by client name
    ClientSecretKey findByClientName(String clientName);
}
