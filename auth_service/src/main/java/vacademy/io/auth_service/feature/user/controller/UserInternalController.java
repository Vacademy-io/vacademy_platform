package vacademy.io.auth_service.feature.user.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
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

    @PostMapping("/create-or-get-existing-by-id")
    @Transactional
    public ResponseEntity<UserDTO> createUserOrGetExisting(@RequestBody UserDTO userDTO, @RequestParam(name = "instituteId",required = false) String instituteId) {
        try {
             User user = null;
             if (!StringUtils.hasText(userDTO.getId())) {
                 user = userService.createUserFromUserDto(userDTO);
             }
             else{
                 user = userService.getOptionalUserById(userDTO.getId()).orElse(userService.createUserFromUserDto(userDTO));
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

}
