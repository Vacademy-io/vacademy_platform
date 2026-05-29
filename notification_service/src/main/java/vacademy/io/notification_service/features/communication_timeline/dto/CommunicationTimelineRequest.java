package vacademy.io.notification_service.features.communication_timeline.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CommunicationTimelineRequest {

    private String userId;

    /** Email address — used as channelId for EMAIL / INBOUND_EMAIL logs. */
    private String email;

    /** Phone number — used as channelId for WhatsApp logs. */
    private String phone;

    /**
     * Filter by channels: EMAIL, WHATSAPP, PUSH, SMS. Null or empty = all channels.
     */
    private List<String> channels;

    /**
     * Filter by direction: ALL, INBOUND, OUTBOUND. Default: ALL
     */
    @Builder.Default
    private String direction = "ALL";

    private Instant fromDate;
    private Instant toDate;

    @Builder.Default
    private Integer page = 0;

    @Builder.Default
    private Integer size = 20;
}
