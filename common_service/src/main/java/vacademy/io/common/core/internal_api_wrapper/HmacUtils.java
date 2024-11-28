package vacademy.io.common.core.internal_api_wrapper;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.WebUtils;
import vacademy.io.common.auth.entity.ClientSecretKey;
import vacademy.io.common.core.internal_api_wrapper.repository.ClientSecretRepository;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Map;
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
