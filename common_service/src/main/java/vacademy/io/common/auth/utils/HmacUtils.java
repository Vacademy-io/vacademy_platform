package vacademy.io.common.auth.utils;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import vacademy.io.common.auth.entity.ClientSecretKey;
import vacademy.io.common.auth.repository.ClientSecretRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.WebUtils;

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

    public static String calculateHmacSignature(HttpServletRequest request, String secret) {
        try {
            // Extract request data
            String method = request.getMethod();
            String uri = request.getRequestURI(); // Get path only


            // Build query string from parameters
            StringBuilder queryString = new StringBuilder();
            Map<String, String[]> parameterMap = request.getParameterMap();
            if (parameterMap != null && !parameterMap.isEmpty()) {
                for (Map.Entry<String, String[]> entry : parameterMap.entrySet()) {
                    String key = entry.getKey();
                    String[] values = entry.getValue();
                    for (String value : values) {
                        // URL encode parameter values
                        queryString.append(key).append("=").append(URLEncoder.encode(value, StandardCharsets.UTF_8)).append("&");
                    }
                }
                // Remove the trailing "&"
                if (queryString.length() > 0) {
                    queryString.deleteCharAt(queryString.length() - 1);
                }
            }


            // Combine request data
            String dataToSign = method + uri + (!queryString.isEmpty() ? "?" + queryString : "");

            // Create a secret key
            SecretKeySpec secretKeySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");

            // Initialize HMAC
            Mac hmac = Mac.getInstance("HmacSHA256");
            hmac.init(secretKeySpec);

            // Generate the signature
            byte[] signatureBytes = hmac.doFinal(dataToSign.getBytes(StandardCharsets.UTF_8));

            String s = Base64.getEncoder().encodeToString(signatureBytes);
            return s;
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            return null;
        }
    }


    public static String calculateHmacSignature(String methodType, String uri, String secret) {
        try {
            // Combine request data
            String encodedURi = UrlUtils.encodeDataAfterQuestionMark(uri);
            String dataToSign = methodType + encodedURi;

            // Create a secret key
            SecretKeySpec secretKeySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");

            // Initialize HMAC
            Mac hmac = Mac.getInstance("HmacSHA256");
            hmac.init(secretKeySpec);

            // Generate the signature
            byte[] signatureBytes = hmac.doFinal(dataToSign.getBytes(StandardCharsets.UTF_8));

            String s = Base64.getEncoder().encodeToString(signatureBytes);
            log.info(s);

            return s;
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            log.error(e.getMessage());
            return null;
        }
    }

    private static String getRequestBody(HttpServletRequest request) {
        try {
            // Read the request body from the input stream
            return readPayload(request);
        } catch (IOException e) {
            log.error(e.getMessage());
            return null;
        }
    }

    public static String readPayload(final HttpServletRequest request) throws IOException {
        String payloadData = null;
        ContentCachingRequestWrapper contentCachingRequestWrapper = WebUtils.getNativeRequest(request, ContentCachingRequestWrapper.class);
        if (null != contentCachingRequestWrapper) {
            // Wait for the request body to be fully processed and cached
            contentCachingRequestWrapper.getContentAsByteArray();
            byte[] buf = contentCachingRequestWrapper.getContentAsByteArray();
            if (buf.length > 0) {
                payloadData = new String(buf, contentCachingRequestWrapper.getCharacterEncoding());
            }
        }

        log.info(payloadData);
        return payloadData;
    }

    public static String convertObjectToJsonString(Object obj) throws JsonProcessingException {
        ObjectMapper mapper = new ObjectMapper();
        return mapper.writerWithDefaultPrettyPrinter().writeValueAsString(obj);
    }

    public String retrieveSecretKeyFromDatabase(String clientName) {
        // Retrieve secret key from the database
        Optional<ClientSecretKey> secretKeyEntity = clientSecretRepository.findById(clientName);
        return secretKeyEntity.map(ClientSecretKey::getSecretKey).orElse(null);
    }
}
