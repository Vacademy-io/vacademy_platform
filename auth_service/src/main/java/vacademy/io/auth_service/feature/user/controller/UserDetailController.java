package vacademy.io.auth_service.feature.user.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.service.UserService;

import java.util.List;

@RestController
@RequestMapping("/auth-service/v1/user-details")
public class UserDetailController {

    @Autowired
    private UserService userService;

    @GetMapping("/by-user-id")
    public ResponseEntity<UserDTO> getUserDetailByUserId(String userId, @RequestAttribute("user") CustomUserDetails customUserDetails) {
        return ResponseEntity.ok(userService.getUserDetailsById(userId));
    }
}
