package vacademy.io.notification_service.features.chatbot_flow.engine.provider;

import java.util.Map;

/**
 * Provider abstraction for sending WhatsApp messages.
 * Implementations handle the API differences between Meta, WATI, and COMBOT.
 */
public interface ChatbotMessageProvider {

    boolean supports(String channelType);

    /**
     * Send a template message.
     * @param phone recipient phone number
     * @param templatePayload provider-agnostic payload with keys:
     *   templateName, languageCode, bodyParams (List<String>),
     *   headerConfig ({type, url, filename}), buttonConfig ([{type, index, urlSuffix/payload}])
     * @param instituteId for credential resolution
     * @param businessChannelId phone_number_id for this institute
     */
    void sendTemplate(String phone, Map<String, Object> templatePayload,
                      String instituteId, String businessChannelId);

    /**
     * Send an interactive message (buttons or list). Session window required.
     * @param phone recipient phone number
     * @param interactivePayload provider-agnostic payload with keys:
     *   interactiveType (button|list), header, body, footer, buttons, sections
     * @param instituteId for credential resolution
     * @param businessChannelId phone_number_id for this institute
     */
    void sendInteractive(String phone, Map<String, Object> interactivePayload,
                         String instituteId, String businessChannelId);

    /**
     * Send a plain text message. Session window required.
     * Used by AI_RESPONSE node to send LLM-generated replies.
     */
    void sendText(String phone, String text, String instituteId, String businessChannelId);
}
