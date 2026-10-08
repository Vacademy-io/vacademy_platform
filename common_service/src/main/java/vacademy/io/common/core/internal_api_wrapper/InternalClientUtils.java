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
import java.net.URI;
import java.util.Map;
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

    /**
     * Same as {@link #makeHmacRequest}, but for a route whose query values the
     * caller has ALREADY percent-encoded.
     *
     * <p>
     * The plain {@code makeHmacRequest} hands {@code RestTemplate} a URL
     * <em>string</em>, which its {@code DefaultUriBuilderFactory} then encodes —
     * so anything the caller encoded first comes out double-encoded ({@code %20}
     * becomes {@code %2520}). That silently broke user lookup for every account
     * whose username contained a non-ASCII character. Building the {@link URI}
     * here with {@code build(true)} — "the route is already encoded" — and
     * passing the URI object means nothing encodes it a second time.
     *
     * <p>
     * Use this whenever a query value can contain anything but
     * {@code [A-Za-z0-9._~-]}, and percent-encode those values yourself
     * (e.g. {@code URLEncoder.encode(v, StandardCharsets.UTF_8)}).
     */
    public ResponseEntity<String> makeHmacRequestWithEncodedRoute(String clientName, String method, String baseUrl,
            String encodedRoute, Object content) {
        String secretKey = hmacUtils.retrieveSecretKeyFromDatabase(clientName);
        if (secretKey == null) {
            throw new RuntimeException("Secret key not found for client: " + clientName);
        }

        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl + encodedRoute).build(true).toUri();

        HttpHeaders headers = new HttpHeaders();
        headers.set("clientName", clientName);
        headers.set("Signature", secretKey);
        headers.set("Content-Type", MediaType.APPLICATION_JSON_VALUE);

        return restTemplate.exchange(
                uri,
                HttpMethod.valueOf(method),
                new HttpEntity<>(content, headers),
                String.class);
    }

    public ResponseEntity<String> makeHmacRequestForMultipartFile(String clientName,
            String method,
            String baseUrl,
            String route,
            MultipartFile file) throws IOException {
        return makeHmacRequestForMultipartFile(clientName, method, baseUrl, route, file, null);
    }

    public ResponseEntity<String> makeHmacRequestForMultipartFile(String clientName,
            String method,
            String baseUrl,
            String route,
            MultipartFile file,
            Map<String, Object> additionalParams) throws IOException {
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
        HttpHeaders partHeaders = new HttpHeaders();
        if (file.getContentType() != null) {
            partHeaders.setContentType(MediaType.parseMediaType(file.getContentType()));
        }
        MultipartInputStreamFileResource resource = new MultipartInputStreamFileResource(file.getInputStream(),
                file.getOriginalFilename());
        HttpEntity<MultipartInputStreamFileResource> partEntity = new HttpEntity<>(resource, partHeaders);
        body.add("file", partEntity);

        if (additionalParams != null) {
            for (Map.Entry<String, Object> entry : additionalParams.entrySet()) {
                body.add(entry.getKey(), entry.getValue());
            }
        }

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
