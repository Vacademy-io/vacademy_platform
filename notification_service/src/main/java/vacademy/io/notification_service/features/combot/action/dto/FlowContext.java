package vacademy.io.notification_service.features.combot.action.dto;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

/**
 * Context object passed to action executors.
 * Contains all information needed to execute an action.
 */
@Data
@Builder
public class FlowContext {

    /**
     * User's phone number
     */
    private String phoneNumber;

    /**
     * Institute ID
     */
    private String instituteId;

    /**
     * User ID (if known)
     */
    private String userId;

    /**
     * Business channel ID (sender's WhatsApp number ID)
     */
    private String businessChannelId;

    /**
     * Channel type (e.g., "WHATSAPP")
     */
    private String channelType;

    /**
     * The actual message text from user
     */
    private String messageText;

    /**
     * Additional user details from admin-core-service
     */
    private Map<String, Object> userDetails;

    private String packageSessionId;
    private String destinationPackageSessionId;
}
