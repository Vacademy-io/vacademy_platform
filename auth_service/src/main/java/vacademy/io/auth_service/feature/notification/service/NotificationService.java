package vacademy.io.auth_service.feature.notification.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.auth_service.feature.notification.constants.NotificationConstant;
import vacademy.io.auth_service.feature.notification.dto.NotificationDTO;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.notification.dto.EmailOTPRequest;
import vacademy.io.common.notification.dto.GenericEmailRequest;

@Service
public class NotificationService {

    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${notification.server.baseurl}")
    private String notificationServerBaseUrl;

    public String sendOtp(EmailOTPRequest emailOTPRequest) {
        // Removed the redundant 'clientName' parameter, we can use the injected clientName field here
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName, // Directly use the injected 'clientName'
                HttpMethod.POST.name(),
                notificationServerBaseUrl,
                NotificationConstant.SEND_EMAIL_OTP,
                emailOTPRequest
        );
        return response.getBody();
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

    public Boolean sendGenericHtmlMail(GenericEmailRequest request) {

        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(clientName, HttpMethod.POST.name(), notificationServerBaseUrl, NotificationConstant.SEND_HTML_EMAIL, request);

        ObjectMapper objectMapper = new ObjectMapper();
        try {
            Boolean isMailSent = objectMapper.readValue(response.getBody(), new TypeReference<Boolean>() {
            });

            return isMailSent;
        } catch (JsonProcessingException e) {
            throw new VacademyException(e.getMessage());
        }
    }

    public String sendEmailToUsers(NotificationDTO notificationDTO) {
        // Removed the redundant 'clientName' parameter, we can use the injected clientName field here
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName, // Directly use the injected 'clientName'
                HttpMethod.POST.name(),
                notificationServerBaseUrl,
                NotificationConstant.EMAIL_TO_USERS,
                notificationDTO
        );
        return response.getBody();

    }
}
