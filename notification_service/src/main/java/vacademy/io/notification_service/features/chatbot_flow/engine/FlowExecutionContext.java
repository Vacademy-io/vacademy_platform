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
}
