package vacademy.io.notification_service.features.chatbot_flow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Fetches user details + custom field values from admin-core-service for
 * placeholder resolution in chatbot flow nodes (SEND_MESSAGE, SEND_TEMPLATE).
 *
 * Wraps the internal endpoint
 *   GET /admin-core-service/internal/user/by-phone?phoneNumber=...
 * which returns {@code UserWithCustomFieldsDTO { user, customFields }}.
 *
 * The response is snake_case on the wire; we flatten to a Map<String,Object>
 * with two top-level keys:
 *   "user"         -> Map of user fields (id, full_name, email, mobile_number, ...)
 *   "customFields" -> Map<String,String> of custom field display name -> value
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserLookupService {

    private final InternalClientUtils internalClientUtils;
    private final ObjectMapper objectMapper;

    @Value("${admin.core.service.baseurl:http://localhost:8081}")
    private String adminCoreServiceUrl;

    @Value("${spring.application.name:notification_service}")
    private String clientName;

    /**
     * Fetch the user and their custom fields by phone number.
     *
     * @param phoneNumber E.164-like phone number (with or without leading +)
     * @return Map with keys "user" and "customFields", or null if lookup fails
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> fetchUserByPhone(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isBlank()) return null;
        try {
            String encoded = URLEncoder.encode(phoneNumber, StandardCharsets.UTF_8);
            String endpoint = "/admin-core-service/internal/user/by-phone?phoneNumber=" + encoded;

            ResponseEntity<String> resp = internalClientUtils.makeHmacRequest(
                    clientName, HttpMethod.GET.name(), adminCoreServiceUrl, endpoint, null);

            if (resp == null || !resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
                log.debug("User lookup returned no body for phone={}", phoneNumber);
                return null;
            }

            Map<String, Object> body = objectMapper.readValue(
                    resp.getBody(), new TypeReference<Map<String, Object>>() {});

            Map<String, Object> result = new HashMap<>();
            Object user = body.get("user");
            result.put("user", user instanceof Map ? user : new HashMap<>());

            // DTO uses SnakeCaseStrategy -> JSON key is "custom_fields"
            Object cf = body.get("custom_fields");
            if (cf == null) cf = body.get("customFields");
            result.put("customFields", cf instanceof Map ? cf : new HashMap<>());

            return result;
        } catch (Exception e) {
            log.warn("Failed to fetch user by phone {}: {}", phoneNumber, e.getMessage());
            return null;
        }
    }
}
