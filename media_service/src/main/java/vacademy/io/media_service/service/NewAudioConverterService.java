package vacademy.io.media_service.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vacademy.io.media_service.dto.AudioConversionResponse;
import vacademy.io.media_service.dto.AudioProcessingResponse;
import vacademy.io.media_service.dto.audio.AudioConversionDeepLevelResponse;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@Service
public class NewAudioConverterService {

    private static final String API_URL = "https://api.assemblyai.com/v2/transcript";
    private static final String APP_KEY = "5085d73bada849fb96ee19c3f1779c25";

    private final RestTemplate restTemplate = new RestTemplate();


    public String getConvertedAudio(String audioId) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", APP_KEY);

            HttpEntity<String> requestEntity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    API_URL + "/" + audioId,
                    HttpMethod.GET,
                    requestEntity,
                    String.class
            );

            if (response.getStatusCode() == HttpStatus.OK) {
                String responseJson = response.getBody();
                ObjectMapper objectMapper = new ObjectMapper();
                AudioConversionResponse audioConversionResponse = objectMapper.readValue(responseJson, AudioConversionResponse.class);
                return audioConversionResponse.getText();
            }
            return null;
        } catch (Exception e) {
            // Handle exception or log error
            return null;
        }
    }


    public String startProcessing(String url) {
        // Create request body with fixed conversion formats
        AudioProcessingRequest requestBody = new AudioProcessingRequest(url);

        // Set headers
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", APP_KEY);

        HttpEntity<AudioProcessingRequest> requestEntity = new HttpEntity<>(requestBody, headers);

        ResponseEntity<String> response = restTemplate.exchange(
                API_URL,
                HttpMethod.POST,
                requestEntity,
                String.class
        );

        // Handle response
        ObjectMapper objectMapper = new ObjectMapper();

        if (response.getStatusCode() == HttpStatus.OK) {
            try {
                AudioProcessingResponse pdfProcessingResponse = objectMapper.readValue(response.getBody(), AudioProcessingResponse.class);
                return pdfProcessingResponse.getId();
            } catch (IOException e) {
                // Handle exception or log error
            }
        }

        return null;
    }

    public AudioConversionDeepLevelResponse getConvertedAudioResponse(String audioId) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", APP_KEY);

            HttpEntity<String> requestEntity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    API_URL + "/" + audioId,
                    HttpMethod.GET,
                    requestEntity,
                    String.class
            );

            if (response.getStatusCode() == HttpStatus.OK) {
                String responseJson = response.getBody();
                ObjectMapper objectMapper = new ObjectMapper();
                AudioConversionDeepLevelResponse audioConversionResponse = objectMapper.readValue(responseJson, AudioConversionDeepLevelResponse.class);
                return audioConversionResponse;
            }
            return null;
        } catch (Exception e) {
            // Handle exception or log error
            return null;
        }
    }

    // Request body class
    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    private static class AudioProcessingRequest {
        private String audio_url;
        private Boolean auto_chapters = true;
        private Boolean auto_highlights = true;
        private String boost_param = "high";
        private Boolean format_text = true;
        private Boolean iab_categories = true;
        private Boolean language_detection = true;
        private Boolean multichannel = true;

        public AudioProcessingRequest(String url) {
            this.audio_url = url;
        }
    }

}