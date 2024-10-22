package vacademy.io.common.notification.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import vacademy.io.common.notification.dto.AlertData;
import org.springframework.stereotype.Service;

import java.io.IOException;

@Service
public class AlertServiceHelper {

    private final ObjectMapper objectMapper;

    public AlertServiceHelper() {
        this.objectMapper = new ObjectMapper();
    }

    public AlertData convertDataJsonToPojo(String jsonData) throws IOException {
        // Parse the JSON string to get the type

        return objectMapper.readValue(jsonData, AlertData.class);
    }
}