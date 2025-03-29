package vacademy.io.assessment_service.features.auth_service.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.auth_service.constants.AuthServiceRoutesConstant;
import vacademy.io.assessment_service.features.notification.constants.NotificationConstant;
import vacademy.io.common.auth.dto.UserWithRolesDTO;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.notification.dto.AttachmentNotificationDTO;

import java.util.Collections;
import java.util.List;

@Service
public class AuthService {

    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${auth.server.baseurl}")
    private String authServerBaseUrl;

    @Autowired
    private ObjectMapper objectMapper;

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);

    public List<UserWithRolesDTO> getUsersByRoles(List<String> roles, String instituteId) {

        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.POST.name(),
                authServerBaseUrl,
                AuthServiceRoutesConstant.USERS_OF_ROLES + "?instituteId=" + instituteId,
                roles
        );

        if (response == null || response.getBody() == null) {
            return Collections.emptyList();
        }

        try {
            return objectMapper.readValue(response.getBody(), new TypeReference<List<UserWithRolesDTO>>() {});
        } catch (Exception e) {
            // Log error for debugging
            logger.error("Failed to parse JSON response for instituteId {}: {}", instituteId, e.getMessage(), e);
            return Collections.emptyList();
        }
    }
}
