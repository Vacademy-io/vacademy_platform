package vacademy.io.notification_service.features.chatbot_flow.engine;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class FlowExecutionContext {
    private String phoneNumber;
    private String instituteId;
    private String userId;
    private String businessChannelId;
    private String channelType;
    private String messageText;

    /** Incoming message type: text, button, interactive, etc. */
    private String messageType;

    /** For button replies: the button ID or payload */
    private String buttonId;
    private String buttonPayload;

    /** For list replies: the selected row ID */
    private String listReplyId;

    /** User details fetched from admin-core-service */
    private Map<String, Object> userDetails;

    /** Session-accumulated context variables */
    private Map<String, Object> sessionVariables;

    /**
     * Set by an executor that already wrote a FAILED notification_log row for the message it was
     * sending (see {@code WhatsAppSendFailureService}). The engine reads-and-clears it so it does
     * not also log the same message as delivered — one bubble per attempt in the Inbox.
     */
    @Builder.Default
    private boolean sendFailureLogged = false;
}
