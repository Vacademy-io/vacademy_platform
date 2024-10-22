package vacademy.io.common.notification.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import vacademy.io.common.auth.utils.HmacClientUtils;
import vacademy.io.common.notification.constant.NotificationConstant;
import vacademy.io.common.notification.dto.EmailOTPRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class OTPInternalService {

    @Autowired
    HmacClientUtils hmacClientUtils;
    @Value(value = "${spring.application.name}")
    String clientName;

    @Value(value = "${notification.service.baseurl:check_for_url}")
    String notificationServerBaseUrl;

    public Boolean verifyOTP(EmailOTPRequest request) {
        log.debug("Entering in verifyOTP Method...");

        ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(clientName, HttpMethod.POST.name(), notificationServerBaseUrl, NotificationConstant.verifyOtpPostRoute, request);

        ObjectMapper objectMapper = new ObjectMapper();
        try {
            Boolean isOtpValid = objectMapper.readValue(response.getBody(), new TypeReference<Boolean>() {
            });

            return isOtpValid;
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }
}
