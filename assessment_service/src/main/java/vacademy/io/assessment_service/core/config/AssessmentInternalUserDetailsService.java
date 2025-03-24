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
import vacademy.io.assessment_service.features.assessment.entity.AssessmentUserRegistration;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentUserRegistrationRepository;
import vacademy.io.common.auth.constants.AuthConstant;
import vacademy.io.common.auth.dto.UserServiceDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;

import java.util.List;
import java.util.Optional;


@Slf4j
@Component
public class AssessmentInternalUserDetailsService {

    @Autowired
    AssessmentUserRegistrationRepository assessmentUserRegistrationRepository;

    @Autowired
    private InternalClientUtils internalClientUtils;

    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        log.debug("Entering in loadUserByUsername Method...");
        String usernameWithoutInstitute = username;
        String instituteId = null;
        String[] stringUsernameSplit = username.split("@");

        if (stringUsernameSplit.length > 1) {
            instituteId = stringUsernameSplit[0];
            usernameWithoutInstitute = stringUsernameSplit[1];
        }

        Optional<AssessmentUserRegistration> user = assessmentUserRegistrationRepository.findTopByUserNameAndInstituteId(usernameWithoutInstitute, instituteId);

        if (user.isEmpty()) {
            throw new UsernameNotFoundException("User not found");
        }

        ObjectMapper objectMapper = new ObjectMapper();

        UserServiceDTO customUserDetails = new UserServiceDTO();
        customUserDetails.setUserId(user.get().getUserId());
        customUserDetails.setUsername(user.get().getUsername());
        customUserDetails.setRoles(List.of("STUDENT"));
        log.info("User Authenticated Successfully..!!!");
        return new CustomUserDetails(customUserDetails);

    }

}
