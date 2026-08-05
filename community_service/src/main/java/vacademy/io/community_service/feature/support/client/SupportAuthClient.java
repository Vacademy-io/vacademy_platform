package vacademy.io.community_service.feature.support.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import vacademy.io.community_service.feature.support.dto.SupportRecipientDto;

import java.util.Collections;
import java.util.List;
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

    /** Only the fields we need; auth-service returns a wider (and evolving) user shape. */
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class AuthUser {
        private String id;
        private String email;
        private String fullName;
    }
}
