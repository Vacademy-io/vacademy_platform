package vacademy.io.auth_service.feature.user.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.auth_service.feature.user.service.UserOperationService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.entity.User;

import java.util.Objects;

@RestController
@RequestMapping("/auth-service/open/user-details")
@RequiredArgsConstructor
public class OpenUserController {
    @Autowired
    private UserOperationService userOperationService;

    @PostMapping("/by-email")
    public ResponseEntity<UserDTO>findUserByEmail(String emailid){
        UserDTO user = userOperationService.findUserByEmail(emailid);
        if (Objects.isNull(user)){
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(userOperationService.findUserByEmail(emailid));
    }
}
