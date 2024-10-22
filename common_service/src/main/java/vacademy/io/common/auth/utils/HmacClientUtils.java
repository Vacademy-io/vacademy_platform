package vacademy.io.common.auth.utils;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;


@Component
public class HmacClientUtils {

    @Autowired
    private HmacUtils hmacUtils;


    public ResponseEntity<String> makeHmacRequest(String clientName, String method, String baseUrl, String route, Object content) {
        // Retrieve the secret key from the database
        String secretKey = hmacUtils.retrieveSecretKeyFromDatabase(clientName);
        if (secretKey == null) {
            throw new RuntimeException("Secret key not found for client: " + clientName);
        }

        // Calculate HMAC signature using request data and the retrieved secret key
        String signature = HmacUtils.calculateHmacSignature(method, route, secretKey);

        // Build the request URL
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(baseUrl + route);
        HttpHeaders headers = new HttpHeaders();
        headers.set("clientName", clientName);
        headers.set("Signature", signature);
        headers.set("Content-Type", MediaType.APPLICATION_JSON_VALUE);

        RestTemplate restTemplate = new RestTemplate();
        // Make the request
        ResponseEntity<String> response = restTemplate.exchange(
                builder.toUriString(),
                HttpMethod.valueOf(method),
                new HttpEntity<>(content, headers),
                String.class
        );

        return response;
    }


    public ResponseEntity<String> makeHmacRequest(String clientName, String method, String baseUrl, String route, Object content, HttpHeaders headers) {
        // Retrieve the secret key from the database
        String secretKey = hmacUtils.retrieveSecretKeyFromDatabase(clientName);
        if (secretKey == null) {
            throw new RuntimeException("Secret key not found for client: " + clientName);
        }

        // Calculate HMAC signature using request data and the retrieved secret key
        String signature = HmacUtils.calculateHmacSignature(method, route, secretKey);

        // Build the request URL
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(baseUrl + route);

        headers.set("clientName", clientName);
        headers.set("Signature", signature);

        RestTemplate restTemplate = new RestTemplate();
        // Make the request
        ResponseEntity<String> response = restTemplate.exchange(
                builder.toUriString(),
                HttpMethod.valueOf(method),
                new HttpEntity<>(content, headers),
                String.class
        );

        return response;
    }


}
