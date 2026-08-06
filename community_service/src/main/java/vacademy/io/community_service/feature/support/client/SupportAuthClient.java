package vacademy.io.community_service.feature.support.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import vacademy.io.community_service.feature.support.dto.SupportRecipientDto;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Resolves an institute's own users from auth-service. Support tickets always carry an
 * {@code instituteId}, but tickets the support team logs on an institute's behalf capture no
 * contact for the institute — this turns the institute into people we can actually notify.
 *
 * <p>The endpoint is Redis-cached on the auth side and marked open for internal service traffic.
 * Every failure degrades to an empty list: a notification is never worth failing a reply over.
 */
@Service
@Slf4j
public class SupportAuthClient {

    private static final String BY_ROLE = "/auth-service/v1/users/by-role";
    private static final String BY_IDS = "/auth-service/v1/users/by-ids";

    @Autowired
    @Qualifier(SupportClientConfig.SUPPORT_REST_TEMPLATE)
    private RestTemplate restTemplate;

    /**
     * Property first, then the raw env var, then blank. application-prod.properties declares
     * neither, so a bare placeholder would fail bean creation and stop the service booting.
     */
    @Value("${auth.server.baseurl:${AUTH_SERVER_BASE_URL:}}")
    private String authServerBaseUrl;

    public List<SupportRecipientDto> findByInstituteAndRole(String instituteId, String roleName) {
        if (!StringUtils.hasText(instituteId) || !StringUtils.hasText(authServerBaseUrl)) {
            return Collections.emptyList();
        }
        try {
            String url = UriComponentsBuilder.fromHttpUrl(authServerBaseUrl + BY_ROLE)
                    .queryParam("instituteId", instituteId)
                    .queryParam("roleName", roleName)
                    .toUriString();

            ResponseEntity<List<AuthUser>> response = restTemplate.exchange(
                    url, HttpMethod.GET, null, new ParameterizedTypeReference<List<AuthUser>>() {
                    });

            List<AuthUser> users = response.getBody();
            if (users == null) {
                return Collections.emptyList();
            }
            return users.stream()
                    .filter(u -> u != null && StringUtils.hasText(u.getEmail()))
                    .map(u -> new SupportRecipientDto(u.getId(), u.getEmail().trim(), u.getFullName()))
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Could not resolve {} users for institute {}: {}",
                    roleName, instituteId, e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Contact details for a single user id. Needed because the ticket's stored raiser "email" is
     * historically a username — the login principal never carried an email address, so the portal
     * recorded {@code getUsername()} in the email column.
     */
    public SupportRecipientDto findById(String userId) {
        if (!StringUtils.hasText(userId) || !StringUtils.hasText(authServerBaseUrl)) {
            return null;
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity =
                    new HttpEntity<>(Map.of("userIds", List.of(userId)), headers);

            ResponseEntity<List<AuthUser>> response = restTemplate.exchange(
                    authServerBaseUrl + BY_IDS, HttpMethod.POST, entity,
                    new ParameterizedTypeReference<List<AuthUser>>() {
                    });

            List<AuthUser> users = response.getBody();
            if (users == null || users.isEmpty()) {
                return null;
            }
            AuthUser u = users.get(0);
            if (u == null || !StringUtils.hasText(u.getEmail())) {
                return null;
            }
            return new SupportRecipientDto(u.getId(), u.getEmail().trim(), u.getFullName());
        } catch (Exception e) {
            log.error("Could not resolve contact for user {}: {}", userId, e.getMessage());
            return null;
        }
    }

    /** Only the fields we need; auth-service returns a wider (and evolving) user shape. */
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class AuthUser {
        private String id;
        private String email;
        private String fullName;
    }
}
