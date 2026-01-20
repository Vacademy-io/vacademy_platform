package vacademy.io.auth_service.feature.user.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.auth.service.AuthService;
import vacademy.io.common.auth.dto.*;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.service.UserService;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/auth-service/v1/user")
@Validated
public class UserController {

    @Autowired
    UserService userService;

    @Autowired
    private AuthService authService;

    // API to create user
    @PostMapping("/internal/create-user")
    @Transactional
    public ResponseEntity<UserDTO> createUser(@RequestBody UserDTO userDTO,
            @RequestParam("instituteId") String instituteId) {
        try {
            User user = authService.createUser(userDTO, instituteId, true);
            return ResponseEntity.ok(new UserDTO(user));
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

    @PostMapping("/internal/create-user-or-get-existing")
    @Transactional
    public ResponseEntity<UserDTO> createUserOrGetExisting(@RequestBody UserDTO userDTO,
            @RequestParam(name = "instituteId", required = false) String instituteId,
            @RequestParam(name = "isNotify", required = false, defaultValue = "true") boolean isNotify) {
        try {
            User user = authService.createUser(userDTO, instituteId, isNotify);
            UserDTO res = new UserDTO(user, userDTO);
            res.setPassword(user.getPassword());
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

    @PutMapping("/internal/update-user")
    public ResponseEntity<UserDTO> updateUser(@RequestBody UserDTO userDTO, @RequestParam("userId") String userId) {
        try {
            return ResponseEntity.ok(userService.updateUserDetails(userDTO, userId));
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

    // API to fetch user details correspond to user id
    @GetMapping("/internal/v1/details/{userId}")
    public ResponseEntity<UserDTO> getUserDetailsById(@PathVariable String userId) {
        UserDTO user = userService.getUserDetailsById(userId);
        return ResponseEntity.ok(user);
    }

    // API to fetch user details corresspond to List of user Id
    @GetMapping("/internal/user-details-list")
    public ResponseEntity<List<UserDTO>> getUserDetailsByIds(@RequestBody List<String> userIds) {
        List<UserDTO> users = userService.getUserDetailsByIds(userIds);
        return ResponseEntity.ok(users);
    }

    // API to remove role from user
    @DeleteMapping("/v1/user-role")
    public ResponseEntity<String> removeRoleFromUser(@RequestBody UserRoleRequestDTO userRoleRequestDTO,
            @RequestAttribute("user") CustomUserDetails user) {

        // Extract userId from CustomUserDetails if needed for further business logic
        String extractedUserId = user.getUserId();

        userService.removeRoleFromUser(userRoleRequestDTO);
        return ResponseEntity.ok("Role removed from user successfully.");
    }

    @PostMapping("/users-by-institute-id-and-roles")
    public ResponseEntity<List<UserWithRolesDTO>> getUsersByInstituteId(@RequestParam("instituteId") String instituteId,
            @RequestBody List<String> roles, @RequestAttribute("user") CustomUserDetails user) {
        List<UserWithRolesDTO> users = userService.getUserDetailsByInstituteId(instituteId, roles, user);
        return ResponseEntity.ok(users);
    }

    @GetMapping("/user-credentials/{userId}")
    public ResponseEntity<UserCredentials> getUserCredentials(@PathVariable String userId,
            @RequestAttribute("user") CustomUserDetails customUserDetails) {
        return ResponseEntity.ok(userService.getUserCredentials(userId, customUserDetails));
    }

    @PostMapping("/internal/users-credential")
    public ResponseEntity<List<UserCredentials>> getUsersCredentials(@RequestBody List<String> userIds) {
        return ResponseEntity.ok(userService.getUsersCredentials(userIds));
    }

    @PostMapping("/users-credential")
    public ResponseEntity<List<UserCredentials>> getUsersCredentials(@RequestBody List<String> userIds,
            @RequestAttribute("user") CustomUserDetails customUserDetails) {
        return ResponseEntity.ok(userService.getUsersCredentials(userIds));
    }

    @PostMapping("/internal/update/details")
    public ResponseEntity<String> updateUserDetails(@RequestBody UserTopLevelDto request,
            @RequestParam("userId") String userId,
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(userService.updateUserDetails(null, request, userId, instituteId));
    }

    @GetMapping("/internal/get/details")
    public ResponseEntity<UserTopLevelDto> getUserDetails(@RequestParam("userId") String userId,
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(userService.getUserTopLevelDetails(null, userId, instituteId));
    }

    @PostMapping("/get-users-of-roles-of-institute")
    public ResponseEntity<List<UserDTO>> getUsersOfRolesOfInstitute(
            @RequestBody List<String> roles,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(name = "inactivityDays", defaultValue = "7") int inactivityDays) {

        List<UserDTO> users = userService.findUsersOfRolesOfInstitute(roles, instituteId, inactivityDays);
        return ResponseEntity.ok(users);
    }

    @PostMapping("/internal/create-multiple-users")
    @Transactional
    public ResponseEntity<List<UserDTO>> createMultipleUsers(@RequestBody List<UserDTO> userDTOs,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(name = "isNotify", required = false, defaultValue = "true") boolean isNotify) {
        try {
            List<UserDTO> users = authService.createMultipleUsers(userDTOs, instituteId, isNotify);
            return ResponseEntity.ok(users);
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

    @GetMapping("/autosuggest-users")
    public ResponseEntity<List<UserDTO>> autoSuggestUsers(@RequestParam("instituteId") String instituteId,
            @RequestParam(value = "roles", required = false) List<String> roles,
            @RequestParam("query") String query) {
        return ResponseEntity.ok(userService.autoSuggestUsers(instituteId, roles, query));
    }

    @PostMapping("/internal/users-with-children")
    public ResponseEntity<List<ParentWithChildDTO>> getUsersWithChildren(
            @RequestBody List<String> userIds) {
        return ResponseEntity.ok(userService.getUsersWithChildren(userIds));
    }

}
