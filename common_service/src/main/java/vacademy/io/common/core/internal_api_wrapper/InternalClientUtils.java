package vacademy.io.common.core.internal_api_wrapper;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

@Component
public class InternalClientUtils {

    @Autowired
    private HmacUtils hmacUtils;

    private final RestTemplate restTemplate = createRestTemplate();

    private static RestTemplate createRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000);
        factory.setReadTimeout(30000);
        return new RestTemplate(factory);
    }

    public ResponseEntity<String> makeHmacRequest(String clientName, String method, String baseUrl, String route,
            Object content) {
        // Retrieve the secret key from the database
        String secretKey = hmacUtils.retrieveSecretKeyFromDatabase(clientName);
        if (secretKey == null) {
            throw new RuntimeException("Secret key not found for client: " + clientName);
        }

        // Build the request URL
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(baseUrl + route);
        HttpHeaders headers = new HttpHeaders();
        headers.set("clientName", clientName);
        headers.set("Signature", secretKey);
        headers.set("Content-Type", MediaType.APPLICATION_JSON_VALUE);

        // Make the request
        ResponseEntity<String> response = restTemplate.exchange(
                builder.toUriString(),
                HttpMethod.valueOf(method),
                new HttpEntity<>(content, headers),
                String.class);

        return response;
    }

    public ResponseEntity<String> makeHmacRequestForMultipartFile(String clientName,
            String method,
            String baseUrl,
            String route,
            MultipartFile file) throws IOException {
        // Retrieve the secret key from the database
        String secretKey = hmacUtils.retrieveSecretKeyFromDatabase(clientName);
        if (secretKey == null) {
            throw new RuntimeException("Secret key not found for client: " + clientName);
        }

        // Build the request URL
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(baseUrl + route);

        HttpHeaders headers = new HttpHeaders();
        headers.set("clientName", clientName);
        headers.set("Signature", secretKey);
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        // Prepare body as multipart
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new MultipartInputStreamFileResource(file.getInputStream(), file.getOriginalFilename()));

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        return restTemplate.exchange(
                builder.toUriString(),
                HttpMethod.valueOf(method),
                requestEntity,
                String.class);
    }

    public ResponseEntity<String> makeHmacRequest(String clientName, String method, String baseUrl, String route,
            Object content, HttpHeaders headers) {
        // Retrieve the secret key from the database
        String secretKey = hmacUtils.retrieveSecretKeyFromDatabase(clientName);
        if (secretKey == null) {
            throw new RuntimeException("Secret key not found for client: " + clientName);
        }

        // Build the request URL
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(baseUrl + route);

        headers.set("clientName", clientName);
        headers.set("Signature", secretKey);

        // Make the request
        ResponseEntity<String> response = restTemplate.exchange(
                builder.toUriString(),
                HttpMethod.valueOf(method),
                new HttpEntity<>(content, headers),
                String.class);

        return response;
    }

}
