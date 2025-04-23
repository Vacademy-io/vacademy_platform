package vacademy.io.media_service.evaluation_ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.evaluation_ai.constants.UserServiceRoutes;

import java.util.List;

@Service
public class AuthService {
    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${auth.server.baseurl}")
    private String authServerBaseUrl;

    public UserDTO createOrGetExistingUser(UserDTO userDTO) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(clientName, HttpMethod.POST.name(),authServerBaseUrl, UserServiceRoutes.ADD_OR_GET_USER_ROUTE, userDTO);
            return objectMapper.readValue(response.getBody(), UserDTO.class);
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }
}
