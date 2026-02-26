package vacademy.io.admin_core_service.features.shortlink.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import java.security.SecureRandom;

@Service
public class ShortLinkIntegrationService {

    @Value("${media.server.baseurl:http://media-service:8075}")
    private String mediaServiceBaseUrl;

    @Value("${short.link.base.url:https://u.vacademy.io}")
    private String shortLinkBaseUrl;

    @Value("${spring.application.name}")
    private String clientName;

    @Autowired
    private InternalClientUtils internalClientUtils;

    public String createShortLink(String shortCode, String destinationUrl, String source, String sourceId) {
        String route = "/media-service/internal/v1/short-link/create";

        CreateShortLinkRequest request = CreateShortLinkRequest.builder()
                .shortCode(shortCode)
                .destinationUrl(destinationUrl)
                .source(source)
                .sourceId(sourceId)
                .build();

        try {
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.POST.name(),
                    mediaServiceBaseUrl,
                    route,
                    request);

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new VacademyException("Failed to create short link via media service");
            }
            return shortLinkBaseUrl + "/s/" + shortCode;
        } catch (Exception e) {
            throw new VacademyException(
                    "Error communicating with media service for short link creation: " + e.getMessage());
        }
    }

    public String generateRandomCode() {
        return generateRandomCode(6);
    }

    public String generateRandomCode(int length) {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            int index = random.nextInt(chars.length());
            sb.append(chars.charAt(index));
        }
        return sb.toString();
    }

    public void updateShortLink(String source, String sourceId, String newDestinationUrl) {
        String route = "/media-service/internal/v1/short-link/update?source=" + source
                + "&sourceId=" + sourceId
                + "&newDestinationUrl=" + newDestinationUrl;

        try {
            internalClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.PUT.name(),
                    mediaServiceBaseUrl,
                    route,
                    null);
        } catch (Exception e) {
            throw new VacademyException(
                    "Error communicating with media service for short link update: " + e.getMessage());
        }
    }

    public void deleteShortLink(String source, String sourceId) {
        String route = "/media-service/internal/v1/short-link/delete?source=" + source
                + "&sourceId=" + sourceId;

        try {
            internalClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.DELETE.name(),
                    mediaServiceBaseUrl,
                    route,
                    null);
        } catch (Exception e) {
            throw new VacademyException(
                    "Error communicating with media service for short link deletion: " + e.getMessage());
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    private static class CreateShortLinkRequest {
        private String shortCode;
        private String destinationUrl;
        private String source;
        private String sourceId;
    }
}
