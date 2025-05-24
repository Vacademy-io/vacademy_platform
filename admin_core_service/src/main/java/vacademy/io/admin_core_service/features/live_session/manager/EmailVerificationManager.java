package vacademy.io.admin_core_service.features.live_session.manager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.constants.NotificationConstant;
import vacademy.io.admin_core_service.features.live_session.service.NotificationServiceEmailVerification;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.notification.dto.EmailOTPRequest;
import com.fasterxml.jackson.core.type.TypeReference;

@Service
public class EmailVerificationManager {

    @Autowired
    NotificationServiceEmailVerification notificationService;

    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${notification.server.baseurl}")
    private String notificationServerBaseUrl;

    public String requestOtp(String Email) {
        // Optional<User> user = userRepository.findTopByEmailOrderByCreatedAtDesc(authR);

//        if (user.isEmpty()) {
//            throw new UsernameNotFoundException("invalid user request..!!");
//        } else {
            // todo: generate OTP for
            notificationService.sendOtp(makeOtp(Email));
            return "OTP sent to " + Email;
        //}

    }
    private EmailOTPRequest makeOtp(String email) {
        return EmailOTPRequest.builder().to(email).service("auth-service").subject("Vacademy | Otp verification. ").name("Vacademy User").build();
    }

    public Boolean verifyOTP(EmailOTPRequest request) {

        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(clientName, HttpMethod.POST.name(), notificationServerBaseUrl, NotificationConstant.VERIFY_EMAIL_OTP, request);

        ObjectMapper objectMapper = new ObjectMapper();
        try {
            Boolean isOtpValid = objectMapper.readValue(response.getBody(), new TypeReference<Boolean>() {
            });

            return isOtpValid;
        } catch (JsonProcessingException e) {
            throw new VacademyException(e.getMessage());
        }
    }
}
