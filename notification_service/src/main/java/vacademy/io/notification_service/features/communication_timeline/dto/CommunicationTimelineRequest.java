package vacademy.io.notification_service.features.communication_timeline.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CommunicationTimelineRequest {

    private String userId;

    /**
     * Filter by channels: EMAIL, WHATSAPP, PUSH, SMS. Null or empty = all channels.
     */
    private List<String> channels;

    /**
     * Filter by direction: ALL, INBOUND, OUTBOUND. Default: ALL
     */
    @Builder.Default
    private String direction = "ALL";

    private LocalDateTime fromDate;
    private LocalDateTime toDate;

    @Builder.Default
    private Integer page = 0;

    @Builder.Default
    private Integer size = 20;
}
