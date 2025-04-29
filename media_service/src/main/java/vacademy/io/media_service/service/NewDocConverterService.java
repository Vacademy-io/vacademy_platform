package vacademy.io.media_service.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class NewDocConverterService {

    private static final String API_URL = "https://api.mathpix.com/v3/converter/";
    private static final String API_PDF_URL = "https://api.mathpix.com/v3/pdf/";
    private static final String APP_ID = "vacademy_8e6a90_950081";
    private static final String APP_KEY = "b27375705e35a88b52f041c5f8eba2dda6a23f36350300d39854c8301b1a9de4";

    private final RestTemplate restTemplate = new RestTemplate();


    public Boolean isConversionCompleted(String pdfId) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("app_id", APP_ID);
        headers.set("app_key", APP_KEY);

        HttpEntity<String> entity = new HttpEntity<>(headers);

        ResponseEntity<ConversionStatusResponse> response = restTemplate.exchange(
                API_URL + pdfId,
                HttpMethod.GET,
                entity,
                ConversionStatusResponse.class
        );

        return response.getStatusCode() == HttpStatus.OK
                && response.getBody() != null
                && "completed".equalsIgnoreCase(response.getBody().getStatus());
    }

    public String getConvertedHtml(String pdfId) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("app_id", APP_ID);
            headers.set("app_key", APP_KEY);

            HttpEntity<String> requestEntity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    API_PDF_URL + pdfId + ".html",
                    HttpMethod.GET,
                    requestEntity,
                    String.class
            );

            if (response.getStatusCode() == HttpStatus.OK) {
                return response.getBody();
            }
            return null;
        } catch (RestClientException e) {
            return null;
        }
    }

    public String startProcessing(String url) {
        // Create request body with fixed conversion formats
        PdfProcessingRequest requestBody = new PdfProcessingRequest(url);

        // Set headers
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("app_id", APP_ID);
        headers.set("app_key", APP_KEY);

        HttpEntity<PdfProcessingRequest> requestEntity = new HttpEntity<>(requestBody, headers);

        ResponseEntity<String> response = restTemplate.exchange(
                API_PDF_URL,
                HttpMethod.POST,
                requestEntity,
                String.class
        );

        // Handle response
        ObjectMapper objectMapper = new ObjectMapper();

        if (response.getStatusCode() == HttpStatus.OK) {
            try {
                PdfProcessingResponse pdfProcessingResponse = objectMapper.readValue(response.getBody(), PdfProcessingResponse.class);
                return pdfProcessingResponse.getPdfId();
            } catch (IOException e) {
                // Handle exception or log error
            }
        }

        return null;
    }

    // Inner class to map the response
    private static class ConversionStatusResponse {
        private String status;

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

    }

    // Request body class
    private static class PdfProcessingRequest {
        private String url;
        private Map<String, Boolean> conversion_formats;

        public PdfProcessingRequest(String url) {
            this.url = url;
            this.conversion_formats = new HashMap<>();
            this.conversion_formats.put("html", true);
        }

        // Getters and setters
        public String getUrl() {
            return url;
        }

        public void setUrl(String url) {
            this.url = url;
        }

        public Map<String, Boolean> getConversion_formats() {
            return conversion_formats;
        }

        public void setConversion_formats(Map<String, Boolean> conversion_formats) {
            this.conversion_formats = conversion_formats;
        }
    }

    // Response class
    @Getter
    @Setter
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class PdfProcessingResponse {
        private String pdfId;

        // Assuming the response contains the PDF ID field
        public String getPdfId() {
            return pdfId;
        }

        public void setPdfId(String pdfId) {
            this.pdfId = pdfId;
        }
    }

}