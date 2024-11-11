package vacademy.io.auth_service.feature.user.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.UserPermissionRequestDTO;
import vacademy.io.common.auth.dto.UserRoleRequestDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.service.UserService;


import java.util.List;

@RestController
public class UserController {

    @Autowired
    UserService userService;


    //API to add role to a user
    @PostMapping("/v1/user-to-role")
    public ResponseEntity<String> addRoleToUser(@RequestBody UserRoleRequestDTO userRoleRequestDTO, @RequestAttribute("user") CustomUserDetails user) {

        // Extract userId from CustomUserDetails for potential future business logic
        String extractedUserId = user.getUserId();

        userService.addRoleToUser(userRoleRequestDTO);
        return ResponseEntity.ok("Role added to user successfully.");
    }

    @PostMapping("/v1/user-to-permission")
    public ResponseEntity<String> addPermissionToUser(@RequestBody UserPermissionRequestDTO userPermissionRequestDTO, @RequestAttribute("user") CustomUserDetails user) {

        // Use the userId extracted from the CustomUserDetails if needed for future logic
        String extractedUserId = user.getUserId();

        userService.addPermissionToUser(userPermissionRequestDTO);
        return ResponseEntity.ok("Permission added to user successfully.");
    }


    //API to fetch user details correspond to user id
    @GetMapping("/internal/v1/details/{userId}")
    public ResponseEntity<UserDTO> getUserDetailsById(@PathVariable String userId) {
        UserDTO user = userService.getUserDetailsById(userId);
        return ResponseEntity.ok(user);
    }

    //API to fetch user details corresspond to List of user Id
    @GetMapping("/internal/v1/user-details-list")
    public ResponseEntity<List<UserDTO>> getUserDetailsByIds(@RequestBody List<String> userIds) {
        List<UserDTO> users = userService.getUserDetailsByIds(userIds);
        return ResponseEntity.ok(users);
    }

    //API to fetch user details by user name
    @GetMapping("/internal/v1/user-details/{username}")
    public ResponseEntity<UserDTO> getUserDetailsByUsername(@PathVariable String username) {
        UserDTO user = userService.getUserDetailsByUsername(username);
        return ResponseEntity.ok(user);

    }

    //API to remove role from user
    @DeleteMapping("/v1/user-role")
    public ResponseEntity<String> removeRoleFromUser(@RequestBody UserRoleRequestDTO userRoleRequestDTO, @RequestAttribute("user") CustomUserDetails user) {

        // Extract userId from CustomUserDetails if needed for further business logic
        String extractedUserId = user.getUserId();

        userService.removeRoleFromUser(userRoleRequestDTO);
        return ResponseEntity.ok("Role removed from user successfully.");
    }


    //API to remove permission from user
    @DeleteMapping("/v1/user-permission")
    public ResponseEntity<String> removePermissionFromUser(@RequestBody UserPermissionRequestDTO userPermissionRequestDTO, @RequestAttribute("user") CustomUserDetails user) {

        // Extract userId from CustomUserDetails if needed for further business logic
        String extractedUserId = user.getUserId();

        userService.removePermissionFromUser(userPermissionRequestDTO);
        return ResponseEntity.ok("Permission removed from user successfully.");
    }

}
