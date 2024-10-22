package vacademy.io.common.notification.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import vacademy.io.common.auth.utils.HmacClientUtils;
import vacademy.io.common.notification.constant.NotificationConstant;
import vacademy.io.common.notification.dto.GenericEmailRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class HtmlEmailService {

    @Autowired
    HmacClientUtils hmacClientUtils;
    @Value(value = "${spring.application.name}")
    String clientName;

    @Value(value = "${notification.service.baseurl:check_for_url}")
    String notificationServerBaseUrl;

    public Boolean sendHtmlEmail(GenericEmailRequest request) {
        log.debug("Entering in verifyOTP Method...");

        ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(clientName, HttpMethod.POST.name(), notificationServerBaseUrl, NotificationConstant.htmlEmail, request);

        ObjectMapper objectMapper = new ObjectMapper();
        try {
            Boolean isEmailSendSuccess = objectMapper.readValue(response.getBody(), new TypeReference<Boolean>() {
            });

            return isEmailSendSuccess;
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }

    public Boolean sendWarRoomAlert(String subject, String body) {
        log.debug("Entering in sendWarRoomAlert Method...");
        try {

            GenericEmailRequest request = new GenericEmailRequest();
            request.setSubject(subject);
            request.setBody(body);
            request.setTo("labourlink-war-room-aaaan5tf7wuke5tmg576nnzfwe@vidyayatantech.slack.com");
            request.setService("WAR_ROOM");
            ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(clientName, HttpMethod.POST.name(), notificationServerBaseUrl, NotificationConstant.htmlEmail, request);

            ObjectMapper objectMapper = new ObjectMapper();
            try {
                Boolean isEmailSendSuccess = objectMapper.readValue(response.getBody(), new TypeReference<Boolean>() {
                });

                return isEmailSendSuccess;
            } catch (JsonProcessingException e) {
                throw new RuntimeException(e);
            }
        }
        catch (Exception ignored) {}
        return false;
    }


}
