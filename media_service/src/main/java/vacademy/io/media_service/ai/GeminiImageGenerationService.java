package vacademy.io.media_service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vacademy.io.media_service.service.HtmlImageConverter;

import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class GeminiImageGenerationService {

    @Value("${gemini.api.key}")
    private String geminiApiKey;

    private final RestTemplate restTemplate;
    private final HtmlImageConverter htmlImageConverter;
    private final ObjectMapper objectMapper;

    // URL from python service
    private static final String GEMINI_IMAGE_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=%s";

    public String generateAndUploadImage(String prompt) {
        try {
            log.info("Generating image with Gemini for prompt: {}", prompt);

            // 1. Call Gemini API
            byte[] imageBytes = callGeminiImageGeneration(prompt);

            if (imageBytes == null) {
                log.warn("Gemini returned no image data for prompt: {}", prompt);
                return null;
            }

            // 2. Upload to S3
            // Convert bytes to Base64 because HtmlImageConverter expects Base64 string
            String base64Image = java.util.Base64.getEncoder().encodeToString(imageBytes);
            // Defaulting to jpeg as Python code does
            String imageUrl = htmlImageConverter.uploadBase64File(base64Image, "jpeg");

            log.info("Generated and uploaded image: {}", imageUrl);
            return imageUrl;

        } catch (Exception e) {
            log.error("Failed to generate/upload image: {}", e.getMessage(), e);
            return null;
        }
    }

    private byte[] callGeminiImageGeneration(String prompt) {
        try {
            String url = String.format(GEMINI_IMAGE_URL_TEMPLATE, geminiApiKey);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            // Construct payload matching Python service
            Map<String, Object> payload = Map.of(
                    "contents", List.of(
                            Map.of("parts", List.of(
                                    Map.of("text", prompt)))),
                    "generationConfig", Map.of(
                            "imageConfig", Map.of("aspectRatio", "16:9"),
                            "responseModalities", List.of("IMAGE")));

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.error("Gemini API error or empty response: {}", response.getBody());
                return null;
            }

            JsonNode root = objectMapper.readTree(response.getBody());

            // Check inlineData
            // Typically response structure: { candidates: [ { content: { parts: [ {
            // inlineData: { mimeType:..., data:... } } ] } } ] }
            // OR top level inlineData (rare)

            JsonNode candidates = root.path("candidates");
            if (candidates.isArray() && candidates.size() > 0) {
                JsonNode parts = candidates.get(0).path("content").path("parts");
                if (parts.isArray()) {
                    for (JsonNode part : parts) {
                        if (part.has("inlineData")) {
                            String dataB64 = part.path("inlineData").path("data").asText();
                            if (dataB64 != null && !dataB64.isEmpty()) {
                                return java.util.Base64.getDecoder().decode(dataB64);
                            }
                        }
                    }
                }
            }

            log.warn("No inlineData found in Gemini response: {}", response.getBody());
            return null;

        } catch (Exception e) {
            log.error("Error calling Gemini API: {}", e.getMessage(), e);
            return null;
        }
    }
}
