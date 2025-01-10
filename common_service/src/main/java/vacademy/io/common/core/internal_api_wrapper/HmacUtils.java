package vacademy.io.common.core.internal_api_wrapper;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.common.auth.entity.ClientSecretKey;
import vacademy.io.common.core.internal_api_wrapper.repository.ClientSecretRepository;

import java.util.Optional;


@Component
@Slf4j
public class HmacUtils {
    @Autowired
    private ClientSecretRepository clientSecretRepository;


    public String retrieveSecretKeyFromDatabase(String clientName) {
        // Retrieve secret key from the database
        Optional<ClientSecretKey> secretKeyEntity = clientSecretRepository.findById(clientName);
        return secretKeyEntity.map(ClientSecretKey::getSecretKey).orElse(null);
    }
}
