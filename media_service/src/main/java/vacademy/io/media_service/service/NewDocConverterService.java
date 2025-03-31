package vacademy.io.media_service.service;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@Service
public class NewDocConverterService {

    private static final String API_URL = "https://api.mathpix.com/v3/converter/";
    private static final String API_PDF_URL = "https://api.mathpix.com/v3/pdf/";
    private static final String APP_ID = "vacademy_8e6a90_aaf3ee";
    private static final String APP_KEY = "87aa763511856bb12b2d06c71f060e2a4fa5bfe24f31501a206f9fc9f9334631";

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
            // Handle exception or log error
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

        ResponseEntity<PdfProcessingResponse> response = restTemplate.exchange(
                API_PDF_URL,
                HttpMethod.POST,
                requestEntity,
                PdfProcessingResponse.class
        );

        if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
            return response.getBody().getPdfId();
        }
        return null;
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
        public String getUrl() { return url; }
        public void setUrl(String url) { this.url = url; }
        public Map<String, Boolean> getConversion_formats() { return conversion_formats; }
        public void setConversion_formats(Map<String, Boolean> conversion_formats) {
            this.conversion_formats = conversion_formats;
        }
    }

    // Response class
    private static class PdfProcessingResponse {
        private String pdfId;

        // Assuming the response contains the PDF ID field
        public String getPdfId() { return pdfId; }
        public void setPdfId(String pdfId) { this.pdfId = pdfId; }
    }

}