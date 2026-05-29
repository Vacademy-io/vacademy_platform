package vacademy.io.auth_service.feature.user.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.core.util.CsvUtil;
import vacademy.io.auth_service.feature.user.service.UserDetailService;
import vacademy.io.auth_service.feature.user.service.UserOperationService;
import vacademy.io.auth_service.feature.user_resolution.service.UserResolutionService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.enums.UserRoleStatus;
import vacademy.io.common.auth.service.UserService;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;

@RestController
@RequestMapping("/auth-service/internal/user")
public class UserInternalController {

    @Autowired
    UserService userService;

    @Autowired
    private UserDetailService userDetailService;

    @Autowired
    private UserResolutionService userResolutionService;

    @Autowired
    private UserOperationService userOperationService;

    @PostMapping("/create-or-get-existing-by-id")
    @Transactional
    public ResponseEntity<UserDTO> createUserOrGetExisting(@RequestBody UserDTO userDTO,
            @RequestParam(name = "instituteId", required = false) String instituteId) {
        try {
            User user = null;
            if (!StringUtils.hasText(userDTO.getId())) {
                user = userService.createUserFromUserDto(userDTO);
            } else {
                user = userService.getOptionalUserById(userDTO.getId())
                        .orElse(userService.createUserFromUserDto(userDTO));
            }
            userService.addUserRoles(instituteId, userDTO.getRoles(), user, UserRoleStatus.ACTIVE.name());
            return ResponseEntity.ok(new UserDTO(user));
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

    @PostMapping("/user-details-list")
    public ResponseEntity<List<UserDTO>> getUserDetailsByIds(@RequestBody List<String> userIds) {
        List<UserDTO> users = userService.getUserDetailsByIds(userIds);
        return ResponseEntity.ok(users);
    }

    @GetMapping("/user-by-id-with-password")
    public ResponseEntity<UserDTO> getUserByIdWithPassword(String userId) {
        return ResponseEntity.ok(userDetailService.getUserByIdWithPassword(userId));
    }

    @PostMapping("/get-users-of-roles-of-institute")
    public ResponseEntity<List<UserDTO>> getUsersOfRolesOfInstitute(
            @RequestBody List<String> roles,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(name = "inactivityDays", defaultValue = "7") int inactivityDays) {

        List<UserDTO> users = userService.findUsersOfRolesOfInstitute(roles, instituteId, inactivityDays);
        return ResponseEntity.ok(users);
    }

    @PostMapping("/get-users-inactive-for-days-or-more-csv")
    public ResponseEntity<byte[]> getUsersInactiveForDaysOrMoreCsv(
            @RequestBody List<String> roles,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(name = "inactivityDays", defaultValue = "7") int inactivityDays,
            @RequestParam(name = "sortDirection", defaultValue = "ASC") String sortDirection) {

        List<UserDTO> users = userService.findUsersInactiveForDaysOrMore(roles, instituteId, inactivityDays);
        return CsvUtil.convertUserListToCsv(users, "inactive_users.csv");
    }

    /**
     * Internal, HMAC-authenticated equivalent of the public autosuggest-users
     * endpoint. Lets other services do a free-text user search against
     * auth_service's DB (full_name / email / mobile_number) scoped to an
     * institute. Returns up to 10 matches.
     */
    @GetMapping("/autosuggest-users")
    public ResponseEntity<List<UserDTO>> autoSuggestUsersInternal(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "roles", required = false) List<String> roles,
            @RequestParam("query") String query) {
        return ResponseEntity.ok(userService.autoSuggestUsers(instituteId, roles, query));
    }

    /**
     * Substring search on full_name / email / mobile_number, optionally scoped to
     * an institute. Returns matching user IDs only — used by other services to
     * pre-fetch IDs whose profile lives here, then join against their own tables
     * (e.g. admin-core leads search). Capped at 500 ids by the underlying query.
     */
    @GetMapping("/by-email")
    public ResponseEntity<UserDTO> getUserByEmail(@RequestParam String email) {
        UserDTO user = userOperationService.findUserByEmail(email.toLowerCase().trim());
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(user);
    }

    @GetMapping("/search-ids")
    public ResponseEntity<List<String>> searchUserIds(
            @RequestParam("query") String query,
            @RequestParam(value = "instituteId", required = false) String instituteId) {
        return ResponseEntity.ok(userResolutionService.searchUserIdsByQuery(query, instituteId));
    }

}
