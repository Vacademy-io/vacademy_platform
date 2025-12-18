package vacademy.io.admin_core_service.features.instructor_copilot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.sentry.Sentry;
import io.sentry.SentryEvent;
import io.sentry.SentryLevel;
import io.sentry.protocol.Message;
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
          SentryEvent event = new SentryEvent();
          event.setLevel(SentryLevel.WARNING);
          Message message = new Message();
          message.setMessage("LLM model failed, attempting fallback: " + e.getMessage());
          event.setMessage(message);
          event.setTag("llm.model", "xiaomi/mimo-v2-flash:free");
          event.setTag("fallback.model", "mistralai/devstral-2512:free");
          event.setTag("operation", "generateContentFromTranscript");
          Sentry.captureEvent(event);
          return callModel("mistralai/devstral-2512:free", prompt, 2);
        })
        .onErrorResume(e -> {
          log.warn("Model mistralai/devstral-2512:free failed, retrying with nvidia/nemotron-3-nano-30b-a3b:free", e);
          SentryEvent event = new SentryEvent();
          event.setLevel(SentryLevel.WARNING);
          Message message = new Message();
          message.setMessage("LLM model failed, attempting final fallback: " + e.getMessage());
          event.setMessage(message);
          event.setTag("llm.model", "mistralai/devstral-2512:free");
          event.setTag("fallback.model", "nvidia/nemotron-3-nano-30b-a3b:free");
          event.setTag("operation", "generateContentFromTranscript");
          Sentry.captureEvent(event);
          return callModel("nvidia/nemotron-3-nano-30b-a3b:free", prompt, 0);
        });
  }

  private Mono<JsonNode> callModel(String model, String prompt, long maxRetries) {
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
        .retryWhen(Retry.fixedDelay(maxRetries, Duration.ofSeconds(2)))
        .flatMap(this::parseResponse);
  }

  private String createPrompt(String transcript) {
    return """
        Analyze the following transcript and generate a JSON response containing a title, summary, flashnotes, flashcards, classwork, and homework.

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
          ],
          "classwork": [
            "Task or activity 1 assigned during class",
            "Task or activity 2 assigned during class"
          ],
          "homework": [
            "Assignment 1 to be completed at home",
            "Assignment 2 to be completed at home"
          ]
        }

        IMPORTANT INSTRUCTIONS FOR CLASSWORK AND HOMEWORK:
        - Carefully analyze the transcript to identify any tasks, activities, assignments, or actionables given to students.
        - "classwork" should contain any in-class activities, exercises, or tasks the teacher asked students to complete during the class session.
        - "homework" should contain any assignments, tasks, or activities the teacher explicitly asked students to complete after class or at home.
        - Each item should be a clear, concise description of the task or assignment.
        - If NO classwork was mentioned in the transcript, return: "classwork": ["No classwork given"]
        - If NO homework was mentioned in the transcript, return: "homework": ["No homework given"]
        - Be thorough and extract all actionables, even if mentioned briefly.

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
        RuntimeException exception = new RuntimeException("Invalid response from LLM: No content found");
        SentryEvent event = new SentryEvent(exception);
        event.setLevel(SentryLevel.ERROR);
        Message message = new Message();
        message.setMessage("Invalid LLM response: No content found in response");
        event.setMessage(message);
        event.setTag("operation", "parseResponse");
        event.setTag("error.type", "MissingContentNode");
        Sentry.captureEvent(event);
        return Mono.error(exception);
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
      SentryEvent event = new SentryEvent(e);
      event.setLevel(SentryLevel.ERROR);
      Message message = new Message();
      message.setMessage("Failed to parse LLM response: " + e.getMessage());
      event.setMessage(message);
      event.setTag("operation", "parseResponse");
      event.setTag("error.type", e.getClass().getSimpleName());
      Sentry.captureEvent(event);
      return Mono.error(e);
    }
  }
}
