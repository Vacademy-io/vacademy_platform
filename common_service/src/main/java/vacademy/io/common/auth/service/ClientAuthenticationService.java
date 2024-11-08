package vacademy.io.common.auth.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.auth.repository.ClientAuthenticationRepository;

@Service
public class ClientAuthenticationService {

    @Autowired
    ClientAuthenticationRepository clientAuthenticationRepository;

    public boolean validateClient(String clientName, String clientToken) {

        return clientAuthenticationRepository.validateClient(clientName, clientToken);
    }
}
