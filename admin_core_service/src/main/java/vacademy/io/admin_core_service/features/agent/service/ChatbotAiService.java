package vacademy.io.admin_core_service.features.agent.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.agent.dto.ChatbotAiRequest;
import vacademy.io.admin_core_service.features.agent.dto.ChatbotAiResponse;
import vacademy.io.admin_core_service.features.agent.dto.ConversationSession;
import vacademy.io.admin_core_service.features.ai_usage.enums.RequestType;
import vacademy.io.admin_core_service.features.credits.client.CreditClient;

import java.util.Map;
import java.util.UUID;

/**
 * One AI turn of an Automations chatbot flow (notification_service's AI_RESPONSE node).
 *
 * <p>Metered like every other AI surface on the platform:
 * <ol>
 *   <li>pre-flight affordability, failing CLOSED — an institute with no credits gets no
 *       model call at all, and the flow hands the learner to a human instead;</li>
 *   <li>the turn's real token counts are written to ai_token_usage as {@code chatbot};</li>
 *   <li>credits are charged against that usage row, attributed to the learner the bot is
 *       talking to and batched by flow id, so it shows up in the AI usage history
 *       alongside every other AI activity.</li>
 * </ol>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ChatbotAiService {

    private static final String DEFAULT_MODEL = "google/gemini-2.5-flash";

    /**
     * Attribution role on the credit transaction. The bot is answering a learner/lead over
     * WhatsApp, not an admin operating the dashboard, so the spend is rolled up under the
     * learner in the per-user usage screens.
     */
    private static final String CREDIT_USER_ROLE = "LEARNER";

    private final LLMService llmService;
    private final CreditClient creditClient;

    public ChatbotAiResponse respond(ChatbotAiRequest request) {
        log.info("Chatbot AI request: institute={}, model={}", request.getInstituteId(), request.getModelId());

        if (request.getUserMessage() == null || request.getUserMessage().isBlank()) {
            return ChatbotAiResponse.builder()
                    .assistantMessage("No message provided.")
                    .exitIntent(false)
                    .build();
        }

        // 1. Affordability, fail CLOSED. hasActiveCredits already returns false when the
        // balance cannot be read, so an unreachable credits service pauses the bot rather
        // than letting it keep spending at the provider un-metered. Same posture as the
        // Engagement Engine's autonomous sends and AI calling.
        if (!hasCredits(request.getInstituteId())) {
            log.warn("Chatbot AI turn refused — institute {} has no AI credits", request.getInstituteId());
            return ChatbotAiResponse.builder()
                    .insufficientCredits(true)
                    .exitIntent(false)
                    .build();
        }

        String model = request.getModelId() != null ? request.getModelId() : DEFAULT_MODEL;

        // Build a ConversationSession from the request
        ConversationSession session = ConversationSession.create(
                request.getSessionId() != null ? request.getSessionId() : UUID.randomUUID().toString(),
                request.getUserId(),
                request.getInstituteId(),
                model,
                null
        );

        // Bucket this call as CHATBOT (not AGENT) and write the usage row synchronously so
        // its id can link the credit transaction back to the tokens that caused it.
        session.getContext().put(LLMService.CTX_REQUEST_TYPE, RequestType.CHATBOT);
        session.getContext().put(LLMService.CTX_USAGE_LOG_SYNC, Boolean.TRUE);

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
        int maxTokens = request.getMaxTokens() > 0 ? request.getMaxTokens() : 500;
        session.getContext().put("max_tokens", maxTokens);
        session.getContext().put("temperature", request.getTemperature() > 0 ? request.getTemperature() : 0.7);
        // buildChatRequest reads the field, not the context entry — without this the node's
        // configured ceiling was ignored and every turn ran at the 4096 default. That is
        // billable output now, so the author's budget has to actually reach the provider.
        session.setMaxTokens(maxTokens);

        try {
            LLMService.LLMResponse response = llmService.generateChatCompletion(session);

            // 2. Charge for the tokens actually burned. Fire-and-forget: the reply is
            // already generated and must not wait on (or be lost to) the billing hop.
            charge(request, model, response);

            log.info("Chatbot AI response generated successfully ({} prompt / {} completion tokens)",
                    response.getPromptTokens(), response.getCompletionTokens());

            return ChatbotAiResponse.builder()
                    .assistantMessage(response.getContent())
                    .promptTokens(response.getPromptTokens())
                    .completionTokens(response.getCompletionTokens())
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

    /** Balance gate. Never throws — an error here is "cannot confirm funds", i.e. no. */
    private boolean hasCredits(String instituteId) {
        try {
            return creditClient.hasActiveCredits(instituteId);
        } catch (Exception e) {
            log.warn("Credit check failed for institute {} — pausing chatbot AI: {}",
                    instituteId, e.getMessage());
            return false;
        }
    }

    /**
     * Charge one chatbot turn. Nothing here may throw: the learner already has the reply,
     * so a billing hiccup must not turn a delivered answer into an error path.
     */
    private void charge(ChatbotAiRequest request, String model, LLMService.LLMResponse response) {
        if (response.getPromptTokens() <= 0 && response.getCompletionTokens() <= 0) {
            // Provider returned no usage block — nothing to price, and a zero-token charge
            // would still bill the request_type's minimum. Skip rather than over-charge.
            return;
        }
        try {
            creditClient.deductAttributedTokenUsageAsync(
                    request.getInstituteId(),
                    RequestType.CHATBOT.getValue(),
                    model,
                    response.getPromptTokens(),
                    response.getCompletionTokens(),
                    response.getUsageLogId(),
                    request.getUserId(),
                    request.getUserId() != null ? CREDIT_USER_ROLE : "SYSTEM",
                    // Actor and subject are the same person here; sending it explicitly keeps
                    // the COALESCE(subject_user_id, user_id) attribution stable if the actor
                    // ever becomes the bot rather than the learner.
                    request.getUserId(),
                    describe(request),
                    request.getFlowId());
        } catch (Exception e) {
            log.error("Chatbot credit charge failed for institute {} (flow {}): {}",
                    request.getInstituteId(), request.getFlowId(), e.getMessage());
        }
    }

    private static String describe(ChatbotAiRequest request) {
        String flow = (request.getFlowName() != null && !request.getFlowName().isBlank())
                ? request.getFlowName()
                : request.getFlowId();
        return flow != null ? "Chatbot AI reply — " + flow : "Chatbot AI reply";
    }
}
