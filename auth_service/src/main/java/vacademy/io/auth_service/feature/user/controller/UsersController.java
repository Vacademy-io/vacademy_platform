package vacademy.io.auth_service.feature.user.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.user.dto.UserDTO;
import vacademy.io.auth_service.feature.user.service.UsersService;


import java.util.List;

@RestController
public class UsersController {

    @Autowired
    UsersService userService;


    //API to add role to a user
    @PostMapping("/v1/user-to-role/{userId}/{roleId}")
    public ResponseEntity<String> addRoleToUser(@PathVariable String userId, @PathVariable String roleId) {
        userService.addRoleToUser(userId, roleId);
        return ResponseEntity.ok("Role added to user successfully.");
    }

    //API to add permission to a user
    @PostMapping("/v1/user-to-permission/{userId}/{permissionId}")
    public ResponseEntity<String> addPermissionToUser(@PathVariable String userId, @PathVariable String permissionId) {
        userService.addPermissionToUser(userId, permissionId);
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
    @DeleteMapping("/v1/user-role/{userId}/{roleId}")
    public ResponseEntity<String> removeRoleFromUser(@PathVariable String userId, @PathVariable String roleId) {
        userService.removeRoleFromUser(userId, roleId);
        return ResponseEntity.ok("Role removed from user successfully.");
    }

    //API to remove permission from user
    @DeleteMapping("/v1/user-permission/{userId}/{permissionId}")
    public ResponseEntity<String> removePermissionFromUser(@PathVariable String userId, @PathVariable String permissionId) {

        userService.removePermissionFromUser(userId, permissionId);
        return ResponseEntity.ok("Permission removed from user successfully.");
    }

}
