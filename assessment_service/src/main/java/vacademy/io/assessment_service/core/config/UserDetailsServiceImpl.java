package vacademy.io.assessment_service.core.config;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;
import vacademy.io.common.auth.constants.AuthConstant;
import vacademy.io.common.auth.dto.UserServiceDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;


@Slf4j
@Component
public class UserDetailsServiceImpl implements UserDetailsService {


    @Value(value = "${spring.application.name}")
    String clientName;
    @Value(value = "${auth.server.baseurl}")
    String authServerBaseUrl;
    @Autowired
    private InternalClientUtils internalClientUtils;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        log.debug("Entering in loadUserByUsername Method...");
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.GET.name(),
                authServerBaseUrl,
                AuthConstant.userServiceRoute + "?userName=" + username,
                null);

        ObjectMapper objectMapper = new ObjectMapper();

        try {
            UserServiceDTO customUserDetails = objectMapper.readValue(response.getBody(), UserServiceDTO.class);
            log.info("User Authenticated Successfully..!!!");
            return new CustomUserDetails(customUserDetails);
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }

}
