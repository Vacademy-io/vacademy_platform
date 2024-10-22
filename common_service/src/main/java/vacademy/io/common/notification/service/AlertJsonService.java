package vacademy.io.common.notification.service;


import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import vacademy.io.common.notification.dto.AlertData;
import vacademy.io.common.notification.dto.Media;
import vacademy.io.common.notification.dto.MediaContent;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;

@Service
public class AlertJsonService {
    private final ObjectMapper objectMapper;

    public AlertJsonService() {
        this.objectMapper = new ObjectMapper();
    }


    @Autowired
    private AlertServiceHelper alertServiceHelper;

    public AlertData processAlertData(String dataJson) {
        try {
            // Now you can use alertData based on its actual type
            return alertServiceHelper.convertDataJsonToPojo(dataJson);
        } catch (IOException e) {
            // Handle parsing exceptions
            e.printStackTrace();
        }

        return null;
    }

    public String createViewMediaLinksJson(List<Media> media) {
        MediaContent mediaContent = new MediaContent();
        mediaContent.setMedia(media);

        AlertData alertData = mediaContent;

        try {
            return objectMapper.writeValueAsString(alertData);
        } catch (JsonProcessingException e) {
            e.printStackTrace();
            return null;
        }
    }
}
