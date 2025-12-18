package vacademy.io.admin_core_service.features.instructor_copilot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class InstructorCopilotLLMService {

  private static final String API_URL = "https://openrouter.ai";
  private final WebClient webClient;
  private final ObjectMapper objectMapper;

  public InstructorCopilotLLMService(@Value("${openrouter.api.key}") String apiKey, ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
    this.webClient = WebClient.builder()
        .baseUrl(API_URL)
        .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
        .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
        .build();
  }

  public Mono<JsonNode> generateContentFromTranscript(String transcript) {
    String prompt = createPrompt(transcript);

    return callModel("xiaomi/mimo-v2-flash:free", prompt, 2)
        .onErrorResume(e -> {
          log.warn("Model xiaomi/mimo-v2-flash:free failed, retrying with mistralai/devstral-2512:free", e);
          return callModel("mistralai/devstral-2512:free", prompt, 2);
        })
        .onErrorResume(e -> {
          log.warn("Model mistralai/devstral-2512:free failed, retrying with nvidia/nemotron-3-nano-30b-a3b:free", e);
          return callModel("nvidia/nemotron-3-nano-30b-a3b:free", prompt, 0);
        })
        .flatMap(this::parseResponse);
  }

  private Mono<String> callModel(String model, String prompt, long maxRetries) {
    Map<String, Object> payload = Map.of(
        "model", model,
        "messages", List.of(
            Map.of("role", "system", "content",
                "You are an expert educational content creator. You analyze transcripts and output educational content in strict JSON format."),
            Map.of("role", "user", "content", prompt)),
        "response_format", Map.of("type", "json_object"));

    return webClient.post()
        .uri("/api/v1/chat/completions")
        .bodyValue(payload)
        .retrieve()
        .bodyToMono(String.class)
        .retryWhen(Retry.fixedDelay(maxRetries, Duration.ofSeconds(2)));
  }

  private String createPrompt(String transcript) {
    return """
        Analyze the following transcript and generate a JSON response containing a title, summary, flashnotes, and flashcards.

        The JSON structure must be exactly as follows:
        {
          "title": "A concise and engaging title",
          "summary": {
            "overview": "A brief overview paragraph",
            "key_points": ["Point 1", "Point 2", "Point 3"]
          },
          "flashnotes": [
            {
              "topic": "Topic Heading",
              "content": "Detailed explanation of the topic. Use markdown for formatting if needed."
            }
          ],
          "flashcards": [
            {
              "front": "Concept or Question",
              "back": "Definition or Answer"
            }
          ]
        }

        Ensure the content is high quality, accurate, and suitable for students.
        Return ONLY the valid JSON object.

        Transcript:
        """
        + transcript;
  }

  private Mono<JsonNode> parseResponse(String responseBody) {
    try {
      JsonNode root = objectMapper.readTree(responseBody);
      JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
      if (contentNode.isMissingNode()) {
        return Mono.error(new RuntimeException("Invalid response from LLM: No content found"));
      }
      String contentString = contentNode.asText();
      // Clean up if wrapped in markdown code blocks
      if (contentString.startsWith("```json")) {
        contentString = contentString.replace("```json", "").replace("```", "").trim();
      } else if (contentString.startsWith("```")) {
        contentString = contentString.replace("```", "").trim();
      }

      return Mono.just(objectMapper.readTree(contentString));
    } catch (Exception e) {
      log.error("Error parsing LLM response", e);
      return Mono.error(e);
    }
  }
}
