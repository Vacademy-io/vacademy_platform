package vacademy.io.auth_service.feature.auth.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;

import java.util.List;
import java.util.Optional;


@RestController
@RequestMapping("auth-service/v1/internal")
public class AuthInternalController {


    @Autowired
    UserRepository userRepository;

    @Autowired
    UserRoleRepository userRoleRepository;

    @GetMapping("/user")
    public ResponseEntity<CustomUserDetails> getUserDetails(@RequestParam String userName) {
        String smallCaseUsername = StringUtils.trimAllWhitespace(userName).toLowerCase();

        String usernameWithoutInstitute = smallCaseUsername;
        String instituteId = null;
        String[] stringUsernameSplit = smallCaseUsername.split("@");

        if (stringUsernameSplit.length > 1) {
            instituteId = stringUsernameSplit[0];
            usernameWithoutInstitute = stringUsernameSplit[1];
        }

        Optional<User> user = userRepository.findByUsername(usernameWithoutInstitute);

        if (user.isEmpty()) {
            throw new UsernameNotFoundException("could not found user..!!");
        }

        List<UserRole> userRoles = userRoleRepository.findByUser(user.get());
        CustomUserDetails customUserDetails = new CustomUserDetails(user.get(), instituteId, userRoles);
        customUserDetails.setPassword(null);

        return ResponseEntity.ok(customUserDetails);
    }

}
