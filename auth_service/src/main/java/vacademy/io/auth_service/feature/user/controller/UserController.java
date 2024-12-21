package vacademy.io.auth_service.feature.user.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.UserPermissionRequestDTO;
import vacademy.io.common.auth.dto.UserRoleRequestDTO;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.service.UserService;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;

@RestController
@RequestMapping("/auth-service/v1/user")
public class UserController {

    @Autowired
    UserService userService;


    //API to create user
    @PostMapping("/internal/create-user")
    @Transactional
    public ResponseEntity<UserDTO> createUser(@RequestBody UserDTO userDTO, @RequestParam("instituteId") String instituteId) {
        try {
            // todo: handle if user already exists
            User user = userService.createUserFromUserDto(userDTO);
            userService.addUserRoles(instituteId, userDTO.getRoles(), user);
            return ResponseEntity.ok(new UserDTO(user));
        }
       catch (Exception e) {
            throw new VacademyException(e.getMessage());
       }
    }


    @PostMapping("/internal/create-user-or-get-existing")
    @Transactional
    public ResponseEntity<UserDTO> createUserOrGetExisting(@RequestBody UserDTO userDTO, @RequestParam("instituteId") String instituteId) {
        try {
            User user = userService.getUserDetailsByUsername(userDTO.getUsername());

            if (user == null)
                user = userService.createUserFromUserDto(userDTO);

            userService.addUserRoles(instituteId, userDTO.getRoles(), user);
            return ResponseEntity.ok(new UserDTO(user));
        }
        catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }


    //API to fetch user details correspond to user id
    @GetMapping("/internal/v1/details/{userId}")
    public ResponseEntity<UserDTO> getUserDetailsById(@PathVariable String userId) {
        UserDTO user = userService.getUserDetailsById(userId);
        return ResponseEntity.ok(user);
    }

    //API to fetch user details corresspond to List of user Id
    @GetMapping("/internal/user-details-list")
    public ResponseEntity<List<UserDTO>> getUserDetailsByIds(@RequestBody List<String> userIds) {
        List<UserDTO> users = userService.getUserDetailsByIds(userIds);
        return ResponseEntity.ok(users);
    }


    //API to remove role from user
    @DeleteMapping("/v1/user-role")
    public ResponseEntity<String> removeRoleFromUser(@RequestBody UserRoleRequestDTO userRoleRequestDTO, @RequestAttribute("user") CustomUserDetails user) {

        // Extract userId from CustomUserDetails if needed for further business logic
        String extractedUserId = user.getUserId();

        userService.removeRoleFromUser(userRoleRequestDTO);
        return ResponseEntity.ok("Role removed from user successfully.");
    }


}
