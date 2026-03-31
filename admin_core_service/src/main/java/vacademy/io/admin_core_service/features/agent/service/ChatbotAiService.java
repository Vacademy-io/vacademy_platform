package vacademy.io.admin_core_service.features.agent.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.agent.dto.ChatbotAiRequest;
import vacademy.io.admin_core_service.features.agent.dto.ChatbotAiResponse;
import vacademy.io.admin_core_service.features.agent.dto.ConversationSession;

import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class ChatbotAiService {

    private final LLMService llmService;

    public ChatbotAiResponse respond(ChatbotAiRequest request) {
        log.info("Chatbot AI request: institute={}, model={}", request.getInstituteId(), request.getModelId());

        if (request.getUserMessage() == null || request.getUserMessage().isBlank()) {
            return ChatbotAiResponse.builder()
                    .assistantMessage("No message provided.")
                    .exitIntent(false)
                    .build();
        }

        // Build a ConversationSession from the request
        ConversationSession session = ConversationSession.create(
                UUID.randomUUID().toString(),
                null,
                request.getInstituteId(),
                request.getModelId() != null ? request.getModelId() : "google/gemini-2.0-flash-001",
                null
        );

        // Add system prompt
        session.addMessage(ConversationSession.ChatMessage.system(
                request.getSystemPrompt() != null ? request.getSystemPrompt() : "You are a helpful assistant."));

        // Add conversation history
        if (request.getConversationHistory() != null) {
            for (Map<String, String> msg : request.getConversationHistory()) {
                String role = msg.get("role");
                String content = msg.get("content");
                if ("user".equals(role)) {
                    session.addMessage(ConversationSession.ChatMessage.user(content));
                } else if ("assistant".equals(role)) {
                    session.addMessage(ConversationSession.ChatMessage.assistant(content));
                }
            }
        }

        // Add current user message
        session.addMessage(ConversationSession.ChatMessage.user(request.getUserMessage()));

        // Set max tokens and temperature in context
        session.getContext().put("max_tokens", request.getMaxTokens() > 0 ? request.getMaxTokens() : 500);
        session.getContext().put("temperature", request.getTemperature() > 0 ? request.getTemperature() : 0.7);

        try {
            // LLMResponse is an inner class of LLMService — no promptTokens/completionTokens fields
            // Token usage is already logged internally by LLMService.logTokenUsage()
            LLMService.LLMResponse response = llmService.generateChatCompletion(session);

            String assistantMessage = response.getContent();

            log.info("Chatbot AI response generated successfully");

            return ChatbotAiResponse.builder()
                    .assistantMessage(assistantMessage)
                    .promptTokens(0)  // Tracked internally by LLMService
                    .completionTokens(0)
                    .exitIntent(false)
                    .build();

        } catch (Exception e) {
            log.error("Chatbot AI generation failed: {}", e.getMessage(), e);
            return ChatbotAiResponse.builder()
                    .assistantMessage("I'm sorry, I'm having trouble right now. Please try again later.")
                    .promptTokens(0)
                    .completionTokens(0)
                    .exitIntent(false)
                    .build();
        }
    }
}
