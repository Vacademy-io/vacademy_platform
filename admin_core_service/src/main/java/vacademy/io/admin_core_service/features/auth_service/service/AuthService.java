package vacademy.io.admin_core_service.features.auth_service.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import vacademy.io.admin_core_service.features.auth_service.constants.AuthServiceRoutes;
import vacademy.io.admin_core_service.features.institute_learner.constants.StudentConstants;
import vacademy.io.admin_core_service.features.learner.dto.JwtResponseDto;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.UserWithJwtDTO;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;

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

    public List<UserDTO> getUsersFromAuthServiceByUserIds(List<String> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return List.of();
        }
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.POST.name(),
                    authServerBaseUrl,
                    AuthServiceRoutes.GET_USERS_FROM_AUTH_SERVICE,
                    userIds
            );

            return objectMapper.readValue(response.getBody(), new TypeReference<List<UserDTO>>() {
            });
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

    public UserDTO updateUser(UserDTO userDTO,String userId) {
        if (userDTO == null || userId == null) {
            throw new VacademyException("User details cannot be null");
        }
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.PUT.name(),
                    authServerBaseUrl,
                    AuthServiceRoutes.UPDATE_USER_ROUTE+"?userId="+userId,
                    userDTO
            );

            return objectMapper.readValue(response.getBody(), new TypeReference<UserDTO>() {
            });
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

    public UserDTO createUserFromAuthService(UserDTO userDTO, String instituteId, boolean sendCred) {
        try {
            String url = StudentConstants.addUserRoute
                    + "?instituteId=" + instituteId
                    + "&isNotify=" + sendCred;

            userDTO.setRootUser(true);
            ObjectMapper objectMapper = new ObjectMapper();

            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.POST.name(),
                    authServerBaseUrl,
                    url,
                    userDTO
            );

            return objectMapper.readValue(response.getBody(), UserDTO.class);

        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

    public UserDTO getUsersFromAuthServiceWithPasswordByUserId(String userId) {
        if (userId == null) {
            return null;
        }
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.GET.name(),
                authServerBaseUrl,
                AuthServiceRoutes.GET_USER_BY_ID_WITH_PASSWORD+"?userId="+userId,
                null
            );

            return objectMapper.readValue(response.getBody(), new TypeReference<UserDTO>() {
            });
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }


    public UserWithJwtDTO generateJwtTokensWithUser(String userId, String instituteId) {
        try {
            String endpoint = AuthServiceRoutes.GENERATE_TOKEN_FOR_LEARNER + "?userId=" + userId + "&instituteId="
                + instituteId;
            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.GET.name(),
                authServerBaseUrl,
                endpoint,
                null);

            if (response == null || response.getBody() == null) {
                throw new VacademyException("Failed to generate JWT tokens");
            }

            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(response.getBody(), UserWithJwtDTO.class);
        } catch (Exception e) {
            throw new VacademyException("Failed to generate JWT tokens: " + e.getMessage());
        }
    }

    public String sendCredToUsers(List<String>userIds) {
        try {
            String endpoint = AuthServiceRoutes.SEND_CRED_TO_USERS;
            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.POST.name(),
                authServerBaseUrl,
                endpoint,
                userIds);

            return response.getBody();
        } catch (Exception e) {
            throw new VacademyException("Failed to generate JWT tokens: " + e.getMessage());
        }
    }


}
