package vacademy.io.common.notification.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import vacademy.io.common.auth.utils.HmacClientUtils;
import vacademy.io.common.notification.constant.NotificationConstant;
import vacademy.io.common.notification.dto.AlertDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class AlertInternalService {

    @Autowired
    HmacClientUtils hmacClientUtils;
    @Value(value = "${spring.application.name}")
    String clientName;

    @Value(value = "${notification.service.baseurl:check_for_url}")
    String notificationServerBaseUrl;

    public AlertDTO createAlert(AlertDTO alertDTO, String userId) {
        ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(clientName, HttpMethod.POST.name(), notificationServerBaseUrl, NotificationConstant.createAlert, alertDTO);

        ObjectMapper objectMapper = new ObjectMapper();
        try {
            return objectMapper.readValue(response.getBody(), new TypeReference<AlertDTO>() {});
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }

    public AlertDTO createEmailAlert(AlertDTO alertDTO, String userId) {
        ResponseEntity<String> response = hmacClientUtils.makeHmacRequest(clientName, HttpMethod.POST.name(), notificationServerBaseUrl, NotificationConstant.createEmailAlert, alertDTO);

        ObjectMapper objectMapper = new ObjectMapper();
        try {
            return objectMapper.readValue(response.getBody(), new TypeReference<AlertDTO>() {});
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }
}
