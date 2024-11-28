package vacademy.io.auth_service.core.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.repository.UserRepository;

import java.util.Optional;


@Slf4j
@Component
public class UserDetailsServiceImpl implements UserDetailsService {


    @Autowired
    private UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        String usernameWithoutInstitute = username;
        String instituteId = null;
        String[] stringUsernameSplit = username.split("@");

        if(stringUsernameSplit.length > 0) {
            instituteId = stringUsernameSplit[0];
            usernameWithoutInstitute = stringUsernameSplit[1];
        }

        Optional<User> user = userRepository.findByUsername(usernameWithoutInstitute);

        if (user.isEmpty()) {
            log.error("Username not found: " + usernameWithoutInstitute);
            throw new UsernameNotFoundException("could not found user..!!");
        }
        log.info("User Authenticated Successfully..!!!");
        return new CustomUserDetails(user.get(), instituteId);
    }

}
