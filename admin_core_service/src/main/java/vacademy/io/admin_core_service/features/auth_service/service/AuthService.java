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

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AuthService {

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(AuthService.class);

    @Autowired
    InternalClientUtils hmacClientUtils;

    @Value(value = "${auth.server.baseurl}")
    String authServerBaseUrl;
    @Value(value = "${spring.application.name}")
    String clientName;

    public UserDTO inviteUser(UserDTO userDTO, String instituteId) {

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
                    userIds);

            return objectMapper.readValue(response.getBody(), new TypeReference<List<UserDTO>>() {
            });
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

    /**
     * Substring search against auth_service's users table (full_name / email /
     * mobile_number). Returns user IDs only — caller can then filter its own
     * tables on user_id IN (...).
     *
     * Returns an empty list on error so a transient auth-service blip degrades
     * search to "no matches" rather than blowing up the caller.
     */
    public List<String> searchUserIdsByQuery(String query, String instituteId) {
        if (query == null || query.isBlank()) return List.of();
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            String encodedQuery = java.net.URLEncoder.encode(query.trim(),
                    java.nio.charset.StandardCharsets.UTF_8);
            StringBuilder path = new StringBuilder(AuthServiceRoutes.SEARCH_USER_IDS)
                    .append("?query=").append(encodedQuery);
            if (instituteId != null && !instituteId.isBlank()) {
                path.append("&instituteId=").append(java.net.URLEncoder.encode(instituteId,
                        java.nio.charset.StandardCharsets.UTF_8));
            }
            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.GET.name(),
                    authServerBaseUrl,
                    path.toString(),
                    null);

            if (response == null || response.getBody() == null) return List.of();
            return objectMapper.readValue(response.getBody(), new TypeReference<List<String>>() {
            });
        } catch (Exception e) {
            logger.warn("searchUserIdsByQuery failed for query='{}', instituteId='{}': {}",
                    query, instituteId, e.getMessage());
            return List.of();
        }
    }

    public UserDTO updateUser(UserDTO userDTO, String userId) {
        if (userDTO == null || userId == null) {
            throw new VacademyException("User details cannot be null");
        }
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.PUT.name(),
                    authServerBaseUrl,
                    AuthServiceRoutes.UPDATE_USER_ROUTE + "?userId=" + userId,
                    userDTO);

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
                    userDTO);

            return objectMapper.readValue(response.getBody(), UserDTO.class);

        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

    public UserDTO createUserFromAuthServiceForLearnerEnrollment(UserDTO userDTO, String instituteId,
            boolean sendCred) {
        return createUserFromAuthServiceForLearnerEnrollment(userDTO, instituteId, sendCred, null);
    }

    public UserDTO createUserFromAuthServiceForLearnerEnrollment(UserDTO userDTO, String instituteId,
            boolean sendCred, String loginUrl) {
        try {
            String url = StudentConstants.addLearnerRoute
                    + "?instituteId=" + instituteId
                    + "&isNotify=" + sendCred;

            if (loginUrl != null && !loginUrl.isBlank()) {
                url += "&loginUrl=" + java.net.URLEncoder.encode(loginUrl, java.nio.charset.StandardCharsets.UTF_8);
            }

            userDTO.setRootUser(true);
            ObjectMapper objectMapper = new ObjectMapper();

            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.POST.name(),
                    authServerBaseUrl,
                    url,
                    userDTO);

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
                    AuthServiceRoutes.GET_USER_BY_ID_WITH_PASSWORD + "?userId=" + userId,
                    null);

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

    public String sendCredToUsers(List<String> userIds) {
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

    /**
     * Idempotently adds the supplied roles to a user in auth-service. No-op
     * when the user already has an ACTIVE row for the given (institute, role)
     * tuple — see {@code RoleService.addRolesToUser} dedup. Failures are
     * logged but not thrown: callers should treat this as best-effort so a
     * transient auth-service hiccup doesn't roll back the enrollment that's
     * already been committed in admin_core_service.
     *
     * <p>Specifically used by the bulk-assign flow to make sure existing users
     * (e.g. leads created from an audience-form submission) carry the
     * {@code STUDENT} role on enrollment, since the learner-portal login
     * rejects users without it.
     */
    public void addRolesToUserInternal(String userId, List<String> roles, String instituteId) {
        if (userId == null || userId.isBlank() || roles == null || roles.isEmpty()
                || instituteId == null || instituteId.isBlank()) {
            return;
        }
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("user_id", userId);
            body.put("roles", roles);
            body.put("institute_id", instituteId);

            hmacClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.POST.name(),
                    authServerBaseUrl,
                    AuthServiceRoutes.ADD_USER_ROLES_INTERNAL,
                    body);
        } catch (Exception e) {
            // Best-effort: log and swallow so a single auth-service blip
            // doesn't fail an entire bulk-assign batch where the admin_core
            // rows have already been written.
            logger.warn("Failed to add roles {} to user {} in institute {}: {}",
                    roles, userId, instituteId, e.getMessage());
        }
    }

    public UserDTO createOrGetExistingUserById(UserDTO userDTO, String instituteId) {
        try {
            String endpoint = AuthServiceRoutes.CREATE_OR_GET_EXISTING_BY_ID + "?instituteId=" + instituteId;
            ObjectMapper objectMapper = new ObjectMapper();

            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.POST.name(),
                    authServerBaseUrl,
                    endpoint,
                    userDTO);

            return objectMapper.readValue(response.getBody(), UserDTO.class);
        } catch (Exception e) {
            throw new VacademyException("Failed to create or get existing user: " + e.getMessage());
        }
    }

    public vacademy.io.admin_core_service.features.student_analysis.dto.StudentLoginStatsDto getStudentLoginStats(
            String userId, String startDate, String endDate) {
        try {
            String endpoint = AuthServiceRoutes.GET_STUDENT_LOGIN_STATS
                    + "?userId=" + userId
                    + "&startDate=" + startDate
                    + "&endDate=" + endDate;

            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.GET.name(),
                    authServerBaseUrl,
                    endpoint,
                    null);

            ObjectMapper objectMapper = new ObjectMapper();
            return objectMapper.readValue(response.getBody(),
                    vacademy.io.admin_core_service.features.student_analysis.dto.StudentLoginStatsDto.class);
        } catch (Exception e) {
            throw new VacademyException("Failed to get student login stats: " + e.getMessage());
        }
    }

    public List<UserDTO> createMultipleUsers(List<UserDTO> userDTOs, String instituteId, boolean toNotifiy) {
        if (userDTOs == null || userDTOs.isEmpty()) {
            throw new VacademyException("User DTOs list cannot be null or empty");
        }
        try {
            String endpoint = AuthServiceRoutes.CREATE_MULTIPLE_USERS + "?instituteId=" + instituteId + "&isNotify="
                    + toNotifiy;
            ObjectMapper objectMapper = new ObjectMapper();

            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.POST.name(),
                    authServerBaseUrl,
                    endpoint,
                    userDTOs);

            return objectMapper.readValue(response.getBody(), new TypeReference<List<UserDTO>>() {
            });
        } catch (Exception e) {
            throw new VacademyException("Failed to create multiple users: " + e.getMessage());
        }
    }

    /**
     * Fetch users with their linked children from auth_service.
     * 
     * @param userIds List of parent user IDs to fetch
     * @return List of ParentWithChildDTO containing parent and child user
     *         information
     */
    public List<vacademy.io.common.auth.dto.ParentWithChildDTO> getUsersWithChildren(List<String> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return List.of();
        }
        try {
            String endpoint = AuthServiceRoutes.GET_USERS_WITH_CHILDREN;
            ObjectMapper objectMapper = new ObjectMapper();

            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.POST.name(),
                    authServerBaseUrl,
                    endpoint,
                    userIds);

            return objectMapper.readValue(response.getBody(),
                    new TypeReference<List<vacademy.io.common.auth.dto.ParentWithChildDTO>>() {
                    });
        } catch (Exception e) {
            throw new VacademyException("Failed to get users with children: " + e.getMessage());
        }
    }

    /**
     * Fetch user by mobile number from auth_service.
     * Handles various phone formats: +917999742868, 7999742868, 917999742868
     * 
     * @param mobileNumber User's phone number in any format
     * @return UserDTO if found, null if not found
     */
    /**
     * Search users in auth_service by free-text query (name/email/mobile),
     * scoped to an institute. Backed by the autosuggest-users endpoint.
     * Returns up to 10 matches.
     */
    public List<UserDTO> autosuggestUsers(String instituteId, String query) {
        if (instituteId == null || instituteId.isBlank() || query == null || query.isBlank()) {
            return List.of();
        }
        try {
            String endpoint = AuthServiceRoutes.AUTOSUGGEST_USERS
                    + "?instituteId=" + java.net.URLEncoder.encode(instituteId, java.nio.charset.StandardCharsets.UTF_8)
                    + "&query=" + java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8);

            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.GET.name(),
                    authServerBaseUrl,
                    endpoint,
                    null);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                ObjectMapper objectMapper = new ObjectMapper();
                return objectMapper.readValue(response.getBody(), new TypeReference<List<UserDTO>>() {});
            }
            return List.of();
        } catch (Exception e) {
            throw new VacademyException("Failed to autosuggest users: " + e.getMessage());
        }
    }

    public UserDTO getUserByEmail(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        try {
            String encodedEmail = java.net.URLEncoder.encode(email.toLowerCase().trim(),
                    java.nio.charset.StandardCharsets.UTF_8);
            String endpoint = AuthServiceRoutes.GET_USER_BY_EMAIL + "?emailId=" + encodedEmail;
            ObjectMapper objectMapper = new ObjectMapper();
            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.GET.name(),
                    authServerBaseUrl,
                    endpoint,
                    null);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return objectMapper.readValue(response.getBody(), UserDTO.class);
            }
            return null;
        } catch (Exception e) {
            if (e.getMessage() != null && e.getMessage().contains("404")) {
                return null;
            }
            logger.warn("getUserByEmail failed for email='{}': {}", email, e.getMessage());
            return null;
        }
    }

    public UserDTO getUserByMobileNumber(String mobileNumber) {
        if (mobileNumber == null || mobileNumber.isBlank()) {
            return null;
        }
        try {
            String endpoint = AuthServiceRoutes.GET_USER_BY_MOBILE + "?mobileNumber=" + mobileNumber;
            ObjectMapper objectMapper = new ObjectMapper();

            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.GET.name(),
                    authServerBaseUrl,
                    endpoint,
                    null);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return objectMapper.readValue(response.getBody(), UserDTO.class);
            }
            return null;
        } catch (Exception e) {
            // A 404 from Auth Service simply means the user doesn't exist yet, which is
            // expected for new admissions.
            if (e.getMessage() != null && e.getMessage().contains("404")) {
                return null;
            }
            throw new VacademyException("Failed to get user by mobile number: " + e.getMessage());
        }
    }

    /**
     * Fetch the user IDs of every user holding a given role within an institute. Returns an
     * empty list (never throws back to caller) when the institute has no such users or when the
     * lookup fails — this is meant for best-effort fallbacks like the doubt-notification cascade,
     * where admin broadcast is a backup, not a hard requirement.
     */
    public List<String> getUserIdsByRole(String instituteId, String roleName) {
        if (instituteId == null || instituteId.isBlank() || roleName == null || roleName.isBlank()) {
            return List.of();
        }
        try {
            String endpoint = AuthServiceRoutes.GET_USERS_BY_ROLE
                    + "?instituteId=" + java.net.URLEncoder.encode(instituteId, java.nio.charset.StandardCharsets.UTF_8)
                    + "&roleName=" + java.net.URLEncoder.encode(roleName, java.nio.charset.StandardCharsets.UTF_8);
            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.GET.name(),
                    authServerBaseUrl,
                    endpoint,
                    null);
            if (response == null || response.getBody() == null
                    || !response.getStatusCode().is2xxSuccessful()) {
                return List.of();
            }
            ObjectMapper objectMapper = new ObjectMapper();
            objectMapper.configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
            List<UserDTO> users = objectMapper.readValue(response.getBody(),
                    new TypeReference<List<UserDTO>>() {});
            return users.stream()
                    .map(UserDTO::getId)
                    .filter(id -> id != null && !id.isEmpty())
                    .distinct()
                    .toList();
        } catch (Exception e) {
            // Swallow — this method only powers fallbacks; failure should not break doubt creation.
            return List.of();
        }
    }

    public void updateInstituteSettings(String instituteId, String userIdentifier) {
        try {
            String endpoint = AuthServiceRoutes.UPDATE_INSTITUTE_SETTINGS;

            // Create a payload similar to UpdateInstituteSettingsDTO from auth_service
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("instituteId", instituteId);
            payload.put("userIdentifier", userIdentifier);
            // Intentionally not setting settingsJson here so it remains null in the DTO,
            // preventing accidental overwrites of existing institute settings in
            // auth_service.

            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.PUT.name(),
                    authServerBaseUrl,
                    endpoint,
                    payload);

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new VacademyException("Failed to update institute settings in auth_service.");
            }
        } catch (Exception e) {
            throw new VacademyException("Failed to update institute settings: " + e.getMessage());
        }
    }
}
