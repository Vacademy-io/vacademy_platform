package vacademy.io.common.auth.repository;

import vacademy.io.common.auth.entity.ClientSecretKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ClientSecretRepository extends JpaRepository<ClientSecretKey, String> {

    // Define a method to find the secret key by client name
    ClientSecretKey findByClientName(String clientName);
}
