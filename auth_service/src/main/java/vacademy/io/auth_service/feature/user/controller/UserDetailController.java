package vacademy.io.auth_service.feature.user.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.user.dto.UserBasicDetailsDto;
import vacademy.io.common.auth.dto.UserJwtUpdateDetail;
import vacademy.io.auth_service.feature.user.service.UserDetailService;
import vacademy.io.auth_service.feature.user.service.UserOperationService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.UserTopLevelDto;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.service.UserService;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;

@RestController
@RequestMapping("/auth-service/v1/user-details")
public class UserDetailController {

    @Autowired
    private UserService userService;

    @Autowired
    private UserDetailService userDetailService;

    @Autowired
    private UserOperationService userOperationService;

    @GetMapping("/by-user-id")
    public ResponseEntity<UserDTO> getUserDetailByUserId(String userId, @RequestAttribute("user") CustomUserDetails customUserDetails) {
        return ResponseEntity.ok(userService.getUserDetailsById(userId));
    }

    @PostMapping("/update")
    public ResponseEntity<String> updateUserDetails(@RequestAttribute("user") CustomUserDetails userDetails,
                                                    @RequestBody UserTopLevelDto request,
                                                    @RequestParam("userId") String userId,
                                                    @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(userService.updateUserDetails(userDetails,request,userId, instituteId));
    }

    @GetMapping("/get")
    public ResponseEntity<UserTopLevelDto> getUserDetails(@RequestAttribute("user") CustomUserDetails userDetails,
                                                          @RequestParam("userId") String userId,
                                                          @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(userService.getUserTopLevelDetails(userDetails,userId,instituteId));
    }
    @PostMapping("/get-basic-details")
    public ResponseEntity<List<UserBasicDetailsDto>> getUserBasicDetails(@RequestAttribute("user") CustomUserDetails userDetails,
                                                                         @RequestBody List<String> userIds) {
        return ResponseEntity.ok(userDetailService.getUserBasicDetails(userDetails,userIds));
    }

    @GetMapping("/jwt-update-time")
    public ResponseEntity<UserJwtUpdateDetail> getUserJwtUpdateTime(@RequestAttribute("user") CustomUserDetails userDetails,@RequestParam("userId") String userId) {
        return ResponseEntity.ok(userService.getUserJwtUpdateDetail(userDetails,userId));
    }

    @PutMapping("/update-user")
    public ResponseEntity<UserDTO> updateUser(@RequestBody UserDTO userDTO, @RequestParam("userId") String userId) {
        try {
            return ResponseEntity.ok(userService.updateUserDetails(userDTO, userId));
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }
    
}
