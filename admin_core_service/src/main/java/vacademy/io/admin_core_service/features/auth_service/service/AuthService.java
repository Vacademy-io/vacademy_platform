package vacademy.io.admin_core_service.features.auth_service.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.constants.AuthServiceRoutes;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;

@Service
public class AuthService {
    @Autowired
    InternalClientUtils hmacClientUtils;

    @Value(value = "${auth.server.baseurl}")
    String authServerBaseUrl;
    @Value(value = "${spring.application.name}")
    String clientName;

    public UserDTO inviteUser(UserDTO userDTO,String instituteId) {

        ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.POST.name(),
                authServerBaseUrl,
                AuthServiceRoutes.INVITE_USER_ROUTE + "?instituteId=" + instituteId,
                userDTO);

        ObjectMapper objectMapper = new ObjectMapper();

        try {
            UserDTO userD = objectMapper.readValue(response.getBody(), UserDTO.class);
            return userD;
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }
}
