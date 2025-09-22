package vacademy.io.auth_service.feature.user.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.user.service.UserOperationService;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.Objects;
import java.util.Optional;

@RestController
@RequestMapping("/auth-service/open/user-details")
@RequiredArgsConstructor
public class OpenUserController {
    @Autowired
    private UserOperationService userOperationService;

    @PostMapping("/by-email")
    public ResponseEntity<UserDTO> findUserByEmail(@RequestParam String emailId){
        UserDTO user = userOperationService.findUserByEmail(emailId);
        if (Objects.isNull(user)){
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(user);
    }

    @GetMapping("/by-username")
    public ResponseEntity<UserDTO> findUserByUsername(
            @RequestParam String username,
            @RequestParam String portal,
            @RequestParam String instituteId) {

        Optional<UserDTO> optionalUser = userOperationService.findByUserName(username, instituteId, portal);

        return optionalUser
                .map(ResponseEntity::ok)        // Return 200 OK with the user
                .orElseGet(() -> ResponseEntity.notFound().build()); // Return 404 if user not found
    }
}
